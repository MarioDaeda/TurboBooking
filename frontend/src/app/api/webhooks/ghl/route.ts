import { NextRequest, NextResponse } from 'next/server';
import { GhlWebhookHandler } from '@/server/integrations/ghl/ghlWebhookHandler';
import { GhlContactMapper } from '@/server/integrations/ghl/ghlContactMapper';
import { InboundWebhookRepository, CustomerRepository, ExternalRefsRepository } from '@/server/db/repositories';
import { ConversationalAgentEngine } from '@/server/domain/conversational/conversationalAgentEngine';
import { InboundMessageEvent } from '@/server/domain/conversational/conversationalTypes';

// =============================================================================
// TURBOBOOKING - GOHIGHLEVEL WEBHOOK ROUTE HANDLER
// Accoglie eventi da GHL: InboundMessage, ContactCreate, ContactUpdate
// =============================================================================

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get('x-ghl-signature') || request.headers.get('x-leadconnector-signature');

  // 1. Verifica firma crittografica HMAC
  const isSignatureValid = GhlWebhookHandler.verifySignature(rawBody, signatureHeader);
  if (!isSignatureValid) {
    return NextResponse.json({ error: 'Invalid GHL HMAC signature' }, { status: 403 });
  }

  let parsedJson: Record<string, unknown>;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedEvent = GhlWebhookHandler.parsePayload(parsedJson);
  const externalId = parsedEvent.eventId || `ghl_${Date.now()}`;

  // 2. Persistenza prima dell'elaborazione (§04.7)
  const { record, isDuplicate } = await InboundWebhookRepository.save({
    provider: 'ghl',
    externalId,
    signatureValid: isSignatureValid,
    payload: parsedJson,
  });

  if (isDuplicate) {
    return NextResponse.json({ status: 'already_processed' }, { status: 202 });
  }

  // 3. Routing di dominio
  try {
    if (parsedEvent.type === 'InboundMessage') {
      const msg = parsedEvent.data;
      const channelMap: Record<string, InboundMessageEvent['channel']> = {
        SMS: 'sms',
        WhatsApp: 'whatsapp',
        IG: 'instagram',
        FB: 'messenger',
        Email: 'sms',
      };

      const inboundEvent: InboundMessageEvent = {
        provider: 'ghl',
        channel: channelMap[msg.messageType] || 'whatsapp',
        senderId: msg.contactId,
        senderPhoneE164: msg.phone,
        text: msg.body,
        timestamp: Date.now(),
        locationId: msg.locationId,
        rawPayload: parsedJson,
      };

      // Inoltro alla medesima logica unificata di TurboBooking
      await ConversationalAgentEngine.processInboundMessage(inboundEvent);
    } else if (parsedEvent.type === 'ContactCreate' || parsedEvent.type === 'ContactUpdate') {
      const contactDto = parsedEvent.data;
      if (contactDto.phone) {
        const mappedInput = GhlContactMapper.toTbCustomerInput(contactDto);
        const customer = await CustomerRepository.upsertFromExternal(mappedInput);

        if (contactDto.id) {
          await ExternalRefsRepository.upsertRef({
            provider: 'ghl',
            entityType: 'customer',
            entityId: customer.id,
            externalId: contactDto.id,
            metadata: { locationId: parsedEvent.locationId },
          });
        }
      }
    }

    await InboundWebhookRepository.markProcessed(record.id);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await InboundWebhookRepository.markProcessed(record.id, errorMsg);
  }

  return NextResponse.json({ status: 'accepted' }, { status: 202 });
}

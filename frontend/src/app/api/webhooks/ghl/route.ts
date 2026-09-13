import { NextRequest, NextResponse } from 'next/server';
import { GhlWebhookHandler, normalizeGhlChannel } from '@/server/integrations/ghl/ghlWebhookHandler';
import { GhlContactMapper } from '@/server/integrations/ghl/ghlContactMapper';
import { InboundWebhookRepository, CustomerRepository, ExternalRefsRepository } from '@/server/db/repositories';
import { ConversationalAgentEngine } from '@/server/domain/conversational/conversationalAgentEngine';
import { InboundMessageEvent } from '@/server/domain/conversational/conversationalTypes';
import { createHash } from 'crypto';

// =============================================================================
// TURBOBOOKING - GOHIGHLEVEL WEBHOOK ROUTE HANDLER
// Accoglie eventi da GHL e ignora esplicitamente gli outbound per evitare loop.
// =============================================================================

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-ghl-signature');

  // 1. Verifica firma Ed25519 corrente (il vecchio header RSA è dismesso)
  const isSignatureValid = GhlWebhookHandler.verifySignature(rawBody, signatureHeader);
  if (!isSignatureValid) {
    return NextResponse.json({ error: 'Invalid GHL Ed25519 signature' }, { status: 403 });
  }

  let parsedJson: Record<string, unknown>;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedEvent = GhlWebhookHandler.parsePayload(parsedJson);
  const messageId = parsedEvent.type === 'InboundMessage'
    ? parsedEvent.data.messageId
    : parsedEvent.type === 'OutboundMessage'
      ? String(parsedEvent.raw.messageId || parsedEvent.raw.message_id || '')
      : '';
  const externalId = parsedEvent.eventId || messageId ||
    `ghl_${createHash('sha256').update(rawBody).digest('hex')}`;

  // 2. Persistenza prima dell'elaborazione (§04.7)
  const { record, isDuplicate } = await InboundWebhookRepository.save({
    provider: 'ghl',
    externalId,
    signatureValid: isSignatureValid,
    payload: parsedJson,
  });

  const claimed = await InboundWebhookRepository.claimForProcessing(record.id);
  if (!claimed) {
    if (isDuplicate && record.processed_at !== null && record.error === null) {
      return NextResponse.json({ status: 'already_processed' }, { status: 202 });
    }
    return NextResponse.json({ status: 'processing_in_progress' }, { status: 202 });
  }
  // 3. Routing di dominio
  try {
    if (parsedEvent.type === 'OutboundMessage') {
      await InboundWebhookRepository.markProcessed(record.id);
      return NextResponse.json({ status: 'ignored_outbound_message' }, { status: 202 });
    }

    if (parsedEvent.type === 'InboundMessage') {
      const msg = parsedEvent.data;
      if (!msg.contactId) throw new Error('GHL InboundMessage: contactId mancante');
      const channel = normalizeGhlChannel(msg.messageType);
      if (!channel) {
        await InboundWebhookRepository.markProcessed(record.id);
        return NextResponse.json({ status: 'ignored_unsupported_channel' }, { status: 202 });
      }

      const inboundEvent: InboundMessageEvent = {
        provider: 'ghl',
        channel,
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
    await InboundWebhookRepository.markFailed(record.id, errorMsg);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ status: 'accepted' }, { status: 202 });
}

import { NextRequest, NextResponse } from 'next/server';
import { MetaSignature } from '@/server/integrations/meta/metaSignature';
import { MetaWebhookParser } from '@/server/integrations/meta/metaWebhookParser';
import { InboundWebhookRepository } from '@/server/db/repositories';
import { ConversationalAgentEngine } from '@/server/domain/conversational/conversationalAgentEngine';
import { InboundMessageEvent } from '@/server/domain/conversational/conversationalTypes';

// =============================================================================
// TURBOBOOKING - META WEBHOOK ROUTE HANDLER (WHATSAPP, INSTAGRAM, MESSENGER, ADS)
// GET: Handshake di verifica token Meta (hub.challenge)
// POST: Ricezione eventi, validazione HMAC-SHA256, persistenza DB e routing AI
// =============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verification = MetaSignature.verifyWebhookChallenge(mode, token, challenge);

  if (verification.isValid && verification.challenge) {
    return new NextResponse(verification.challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Meta token verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-hub-signature-256');

  // 1. Verifica crittografica HMAC-SHA256
  const isSignatureValid = MetaSignature.verifyPayloadSignature(rawBody, signatureHeader);
  if (!isSignatureValid) {
    return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 403 });
  }

  let parsedJson: Record<string, unknown>;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 2. Persistenza immediata in inbound_webhooks prima dell'elaborazione (§04.7)
  const normalizedMessages = MetaWebhookParser.parse(parsedJson);
  const externalId = normalizedMessages[0]?.messageId || `meta_${Date.now()}`;

  const { record, isDuplicate } = await InboundWebhookRepository.save({
    provider: 'meta',
    externalId,
    signatureValid: isSignatureValid,
    payload: parsedJson,
  });

  if (isDuplicate) {
    // Risponde 200/202 subito per fermare i retry del webhook provider
    return NextResponse.json({ status: 'already_processed' }, { status: 202 });
  }

  // 3. Elaborazione asincrona attraverso l'unica logica di dominio (ConversationalAgentEngine)
  try {
    for (const msg of normalizedMessages) {
      const inboundEvent: InboundMessageEvent = {
        provider: 'meta',
        channel: msg.channel === 'leadgen' ? 'whatsapp' : msg.channel,
        senderId: msg.senderId,
        senderPhoneE164: msg.senderPhoneE164,
        senderName: msg.senderName,
        text: msg.text,
        timestamp: msg.timestamp,
        rawPayload: msg.rawPayload,
      };

      await ConversationalAgentEngine.processInboundMessage(inboundEvent);
    }

    await InboundWebhookRepository.markProcessed(record.id);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await InboundWebhookRepository.markProcessed(record.id, errorMsg);
  }

  // Risposta rapida per rispettare il timeout Meta (< 3 secondi)
  return NextResponse.json({ status: 'accepted', processed: normalizedMessages.length }, { status: 202 });
}

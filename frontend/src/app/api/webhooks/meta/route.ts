import { NextRequest, NextResponse } from 'next/server';
import { MetaSignature } from '@/server/integrations/meta/metaSignature';
import { MetaWebhookParser } from '@/server/integrations/meta/metaWebhookParser';
import {
  InboundWebhookRepository,
  NotificationRepository,
  ProviderEventKey,
  ProviderEventRepository,
} from '@/server/db/repositories';
import { ConversationalAgentEngine } from '@/server/domain/conversational/conversationalAgentEngine';
import { InboundMessageEvent } from '@/server/domain/conversational/conversationalTypes';
import { MetaMediaClient } from '@/server/integrations/meta/metaMediaClient';
import { ServiceMessageCounter } from '@/server/domain/messaging/serviceMessageCounter';
import { createHash } from 'crypto';
import { MetaLeadHandler } from '@/server/integrations/meta/metaLeadHandler';

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

async function processProviderEvent(
  key: ProviderEventKey,
  task: () => Promise<void>
): Promise<boolean> {
  const claimed = await ProviderEventRepository.claim(key);
  if (!claimed) return false;

  try {
    await task();
    await ProviderEventRepository.markProcessed(key);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await ProviderEventRepository.markFailed(key, message);
    throw error;
  }
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
  const normalizedStatuses = MetaWebhookParser.parseStatuses(parsedJson);
  // Meta non fornisce un ID univoco della consegna webhook: l'hash del raw body
  // deduplica retry identici senza confondere sent/delivered/read dello stesso messaggio.
  const externalId = `meta_${createHash('sha256').update(rawBody).digest('hex')}`;

  const { record, isDuplicate } = await InboundWebhookRepository.save({
    provider: 'meta',
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

  // 3. Elaborazione sincrona con claim per singolo evento: un retry parziale
  // salta messaggi e delivery status già completati.
  let processedMessages = 0;
  let processedStatuses = 0;
  try {
    for (const delivery of normalizedStatuses) {
      const handled = await processProviderEvent({
        provider: 'meta',
        eventType: `delivery_${delivery.status}`,
        externalId: delivery.messageId,
      }, async () => {
        await NotificationRepository.updateProviderStatus({
          providerMessageId: delivery.messageId,
          status: delivery.status,
          error: delivery.error,
        });
        if (delivery.phoneNumberId) {
          ServiceMessageCounter.record({
            phoneNumberId: delivery.phoneNumberId,
            messageId: delivery.messageId,
            pricingCategory: delivery.pricingCategory,
          });
        }
      });
      if (handled) processedStatuses += 1;
    }

    for (const msg of normalizedMessages) {
      const key: ProviderEventKey = {
        provider: 'meta',
        eventType: msg.channel === 'leadgen' ? 'lead' : 'message',
        externalId: msg.messageId,
      };
      const handled = await processProviderEvent(key, async () => {
        if (msg.channel === 'leadgen') {
          await MetaLeadHandler.process(msg);
          return;
        }

        const media = msg.imageMediaId
          ? await MetaMediaClient.fetchMediaAsBase64(msg.imageMediaId)
          : null;
        const inboundEvent: InboundMessageEvent = {
          provider: 'meta',
          channel: msg.channel,
          senderId: msg.senderId,
          senderPhoneE164: msg.senderPhoneE164,
          senderName: msg.senderName,
          text: msg.text,
          imageBase64: media?.base64,
          imageMimeType: media?.mimeType || msg.imageMimeType,
          timestamp: msg.timestamp,
          rawPayload: msg.rawPayload,
        };

        await ConversationalAgentEngine.processInboundMessage(inboundEvent);
      });
      if (handled) processedMessages += 1;
    }

    await InboundWebhookRepository.markProcessed(record.id);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await InboundWebhookRepository.markFailed(record.id, errorMsg);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  // Risposta rapida per rispettare il timeout Meta (< 3 secondi)
  return NextResponse.json({
    status: 'accepted',
    processed: processedMessages,
    deliveryStatuses: processedStatuses,
  }, { status: 202 });
}

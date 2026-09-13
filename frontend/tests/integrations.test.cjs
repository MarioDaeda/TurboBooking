const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, generateKeyPairSync, sign } = require('node:crypto');
const { load } = require('./load-ts.cjs');

test('Meta signatures fail closed in production and validate HMAC-SHA256', () => {
  const previous = { nodeEnv: process.env.NODE_ENV, secret: process.env.META_APP_SECRET };
  process.env.NODE_ENV = 'production';
  delete process.env.META_APP_SECRET;
  const { MetaSignature } = load('src/server/integrations/meta/metaSignature.ts');
  assert.equal(MetaSignature.verifyPayloadSignature('{}', null), false);
  process.env.META_APP_SECRET = 'real-test-secret';
  const body = '{"event":"ok"}';
  const digest = createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex');
  assert.equal(MetaSignature.verifyPayloadSignature(body, `sha256=${digest}`), true);
  assert.equal(MetaSignature.verifyPayloadSignature(`${body}x`, `sha256=${digest}`), false);
  if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
  if (previous.secret === undefined) delete process.env.META_APP_SECRET; else process.env.META_APP_SECRET = previous.secret;
});

test('GHL verifies X-GHL-Signature with Ed25519 and rejects missing signatures', () => {
  const previous = { nodeEnv: process.env.NODE_ENV, key: process.env.GHL_WEBHOOK_PUBLIC_KEY };
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  process.env.NODE_ENV = 'production';
  process.env.GHL_WEBHOOK_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' });
  const body = '{"type":"ContactCreate"}';
  const signature = sign(null, Buffer.from(body), privateKey).toString('base64');
  const { GhlWebhookHandler } = load('src/server/integrations/ghl/ghlWebhookHandler.ts');
  assert.equal(GhlWebhookHandler.verifySignature(body, signature), true);
  assert.equal(GhlWebhookHandler.verifySignature(`${body}x`, signature), false);
  assert.equal(GhlWebhookHandler.verifySignature(body, null), false);
  if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
  if (previous.key === undefined) delete process.env.GHL_WEBHOOK_PUBLIC_KEY; else process.env.GHL_WEBHOOK_PUBLIC_KEY = previous.key;
});

test('Meta parser preserves image media and delivery statuses', () => {
  const { MetaWebhookParser } = load('src/server/integrations/meta/metaWebhookParser.ts');
  const payload = {
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'phone-1' },
      contacts: [{ profile: { name: 'Mario' } }],
      messages: [{ id: 'image-1', from: '393401234567', type: 'image', timestamp: '1', image: { id: 'media-1', mime_type: 'image/jpeg' } }],
      statuses: [{ id: 'out-1', status: 'delivered', pricing: { category: 'service' } }],
    } }] }],
  };
  const messages = MetaWebhookParser.parse(payload);
  assert.equal(messages[0].imageMediaId, 'media-1');
  assert.equal(messages[0].text, '');
  const statuses = MetaWebhookParser.parseStatuses(payload);
  assert.deepEqual(statuses[0], {
    messageId: 'out-1', status: 'delivered', phoneNumberId: 'phone-1', pricingCategory: 'service', error: undefined,
  });
});

test('webhook repository treats provider/external_id conflicts as duplicates', async () => {
  let singles = 0;
  const existing = { id: 'existing', provider: 'meta', external_id: 'evt-1' };
  const query = {
    insert() { return this; }, select() { return this; }, eq() { return this; },
    async single() {
      singles += 1;
      return singles === 1 ? { data: null, error: { code: '23505', message: 'duplicate key' } } : { data: existing, error: null };
    },
  };
  const { InboundWebhookRepository } = load('src/server/db/repositories.ts', {
    './supabaseClient': { getSupabaseAdminClient: () => ({ from: () => query }) },
  });
  const result = await InboundWebhookRepository.save({ provider: 'meta', externalId: 'evt-1', signatureValid: true, payload: {} });
  assert.equal(result.isDuplicate, true);
  assert.equal(result.record.id, 'existing');
});

test('social contacts are created with null phone and linked by external ref', async () => {
  let createdInput;
  let linked;
  const customer = { id: 'customer-1', first_name: 'Social', last_name: 'Direct', phone: null, email: null };
  const { ConversationalAgentEngine } = load('src/server/domain/conversational/conversationalAgentEngine.ts', {
    '../../db/repositories': {
      CustomerRepository: { create: async input => { createdInput = input; return customer; } },
      ExternalRefsRepository: {
        getByExternalId: async () => null,
        upsertRef: async input => { linked = input; },
      },
      NotificationRepository: { log: async () => {} },
    },
    '../booking/availabilityService': { AvailabilityService: {} },
    '../../integrations/meta/metaSender': { MetaSender: { sendGraphMessage: async () => ({ success: true, messageId: 'out-1' }) } },
    '../../integrations/ghl/ghlNotificationChannel': { GoHighLevelChannel: class {} },
    './geminiBookingAgent': { GeminiBookingAgent: {} },
  });
  await ConversationalAgentEngine.processInboundMessage({
    provider: 'meta', channel: 'instagram', senderId: 'ig-1', senderName: 'Social', text: 'ciao', timestamp: 1, rawPayload: {},
  });
  assert.equal(createdInput.phone, null);
  assert.equal(linked.externalId, 'ig-1');
  assert.equal(linked.entityId, 'customer-1');
});

test('provider senders fail closed when production configuration is missing', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.META_WHATSAPP_TOKEN;
  delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const { MetaSender } = load('src/server/integrations/meta/metaSender.ts');
  const result = await MetaSender.sendWhatsAppText({ toPhone: '+39123', text: 'test' });
  assert.equal(result.success, false);
  assert.match(result.error, /non configurato/);
  if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
});

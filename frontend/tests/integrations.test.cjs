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

test('Rome timezone helpers are the single calendar/formatting source', () => {
  const { formatRomeDateTime, getRomeToday } = load('src/lib/romeTime.ts');
  assert.equal(getRomeToday(new Date('2026-01-15T23:30:00Z')), '2026-01-16');
  const formatted = formatRomeDateTime('2026-01-15T14:30:00Z');
  assert.equal(formatted.date, '2026-01-15');
  assert.equal(formatted.time, '15:30');
  assert.equal(formatted.weekday, 'giovedì');
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

test('GHL parser keeps provider webhook/message ids and rejects unknown channels', () => {
  const { GhlWebhookHandler, normalizeGhlChannel } = load('src/server/integrations/ghl/ghlWebhookHandler.ts');
  const event = GhlWebhookHandler.parsePayload({
    type: 'InboundMessage',
    id: 'contact-id-must-not-be-used-as-event-id',
    webhookId: 'webhook-1',
    contactId: 'contact-1',
    messageId: 'message-1',
    messageType: 'Email',
    body: 'ciao',
  });
  assert.equal(event.eventId, 'webhook-1');
  assert.equal(event.data.messageId, 'message-1');
  const create = GhlWebhookHandler.parsePayload({ type: 'ContactCreate', webhookId: 'delivery-create', id: 'contact-1' });
  const update = GhlWebhookHandler.parsePayload({ type: 'ContactUpdate', webhookId: 'delivery-update', id: 'contact-1' });
  assert.notEqual(create.eventId, update.eventId);
  assert.equal(normalizeGhlChannel('sms'), 'sms');
  assert.equal(normalizeGhlChannel('ig'), 'instagram');
  assert.equal(normalizeGhlChannel('Email'), null);
  assert.equal(normalizeGhlChannel('unknown'), null);
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

test('webhook repository claims pending work and does not reprocess completed work', async () => {
  let state = 'pending';
  let previousState = state;
  const row = { id: 'webhook-1', processing_status: 'pending' };
  const query = {
    update(patch) { previousState = state; if (patch.processing_status) state = patch.processing_status; return this; },
    eq() { return this; },
    in() { return this; },
    lt() { return this; },
    select() { return this; },
    async maybeSingle() {
      if (previousState === 'pending') return { data: { ...row, processing_status: 'processing' }, error: null };
      return { data: null, error: null };
    },
  };
  const { InboundWebhookRepository } = load('src/server/db/repositories.ts', {
    './supabaseClient': { getSupabaseAdminClient: () => ({ from: () => query }) },
  });
  assert.equal((await InboundWebhookRepository.claimForProcessing('webhook-1')).processing_status, 'processing');
  state = 'processed';
  assert.equal(await InboundWebhookRepository.claimForProcessing('webhook-1'), null);
});

test('customer creation persists privacy and marketing consent separately', async () => {
  let inserted;
  const fakeCustomer = { id: 'customer-1', first_name: 'Mario', last_name: 'Rossi', phone: '+39123', email: null, has_privacy_consent: true, marketing_consent: false };
  const customers = {
    insert(row) { inserted = row; return this; },
    select() { return this; },
    async single() { return { data: fakeCustomer, error: null }; },
  };
  const { CustomerRepository } = load('src/server/db/repositories.ts', {
    './supabaseClient': { getSupabaseAdminClient: () => ({ from: () => customers }) },
  });
  await CustomerRepository.create({ firstName: 'Mario', lastName: 'Rossi', phone: '+39123', privacyConsent: true, marketingConsent: false });
  assert.equal(inserted.has_privacy_consent, true);
  assert.equal(inserted.marketing_consent, false);
  assert.ok(inserted.privacy_consent_at);
  assert.equal(inserted.marketing_consent_at, null);
});

test('GHL channel routes fields per channel and blocks missing consent', async () => {
  const logs = [];
  let sent;
  const { GoHighLevelChannel } = load('src/server/integrations/ghl/ghlNotificationChannel.ts', {
    '../../db/repositories': { NotificationRepository: { log: async entry => logs.push(entry) } },
    './ghlClient': { ghlClient: { sendMessage: async params => { sent = params; return { messageId: 'msg-1', status: 'sent' }; } } },
  });
  const customer = { id: 'customer-1', has_privacy_consent: true, marketing_consent: false };
  const receipt = await new GoHighLevelChannel('email').send({ recipientAddress: 'mario@example.test', subject: 'Conferma', body: 'ok', isTransactional: true, locationId: 'loc-1' }, customer);
  assert.equal(receipt.success, true);
  assert.equal(sent.type, 'Email');
  assert.equal(sent.email, 'mario@example.test');
  assert.equal(sent.phone, undefined);
  const rejected = await new GoHighLevelChannel('sms').send({ recipientAddress: '+39123', body: 'promo', isTransactional: false, locationId: 'loc-1' }, customer);
  assert.equal(rejected.success, false);
  assert.equal(logs.at(-1).status, 'rejected_no_consent');
  const noPrivacy = await new GoHighLevelChannel('sms').send({ recipientAddress: '+39123', body: 'conferma', isTransactional: true, locationId: 'loc-1' }, { ...customer, has_privacy_consent: false });
  assert.equal(noPrivacy.success, false);
});

test('GHL outbound failure is propagated by the conversational engine', async () => {
  const { ConversationalAgentEngine } = load('src/server/domain/conversational/conversationalAgentEngine.ts', {
    '../../db/repositories': { NotificationRepository: { log: async () => {} } },
    '../../integrations/meta/metaSender': { MetaSender: {} },
    '../../integrations/ghl/ghlNotificationChannel': {
      GoHighLevelChannel: class { async send() { return { success: false, error: 'provider down' }; } },
    },
    '../booking/availabilityService': { AvailabilityService: {} },
    './geminiBookingAgent': { GeminiBookingAgent: {} },
  });
  await assert.rejects(
    () => ConversationalAgentEngine.dispatchOutboundReply(
      { provider: 'ghl', channel: 'sms', senderId: 'contact-1', text: 'ciao', timestamp: 1, rawPayload: {} },
      'risposta',
      { id: 'customer-1', first_name: 'Mario', has_privacy_consent: true, marketing_consent: false }
    ),
    /provider down/
  );
});

test('Meta Lead Ads uses a dedicated customer handler, not the conversation engine', async () => {
  let upserted;
  let ref;
  const { MetaLeadHandler } = load('src/server/integrations/meta/metaLeadHandler.ts', {
    '../../db/repositories': {
      CustomerRepository: { upsertFromExternal: async input => { upserted = input; return { id: 'customer-1' }; } },
      ExternalRefsRepository: { upsertRef: async input => { ref = input; } },
    },
  });
  const previous = process.env.META_PAGE_ACCESS_TOKEN;
  delete process.env.META_PAGE_ACCESS_TOKEN;
  await MetaLeadHandler.process({
    messageId: 'lead-1', channel: 'leadgen', senderId: 'lead-1', text: 'lead', timestamp: 1,
    rawPayload: { leadgen_id: 'lead-1', field_data: [{ field_name: 'full_name', values: ['Mario Rossi'] }, { field_name: 'phone_number', values: ['+39123'] }] },
  });
  assert.equal(upserted.firstName, 'Mario');
  assert.equal(upserted.privacyConsent, true);
  assert.equal(upserted.marketingConsent, false);
  assert.equal(ref.externalId, 'lead-1');
  if (previous === undefined) delete process.env.META_PAGE_ACCESS_TOKEN; else process.env.META_PAGE_ACCESS_TOKEN = previous;
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

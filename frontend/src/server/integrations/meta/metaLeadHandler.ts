import { CustomerRepository, ExternalRefsRepository } from '../../db/repositories';
import { NormalizedMetaMessage } from './metaWebhookParser';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

type LeadField = { field_name?: string; name?: string; values?: unknown[] };

function fieldsToRecord(fields: unknown): Record<string, string> {
  if (!Array.isArray(fields)) return {};
  return Object.fromEntries((fields as LeadField[]).flatMap((field) => {
    const key = String(field.field_name || field.name || '').toLowerCase();
    const value = Array.isArray(field.values) ? field.values[0] : undefined;
    return key && value !== undefined ? [[key, String(value)]] : [];
  }));
}

function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits ? (phone.trim().startsWith('+') ? `+${digits}` : `+${digits}`) : null;
}

export const MetaLeadHandler = {
  async process(message: NormalizedMetaMessage): Promise<void> {
    const leadgenId = message.messageId;
    const raw = message.rawPayload as Record<string, unknown>;
    let fields = fieldsToRecord(raw.field_data);
    const token = process.env.META_PAGE_ACCESS_TOKEN;

    if (token && leadgenId) {
      const response = await fetch(`${GRAPH_BASE}/${encodeURIComponent(leadgenId)}?fields=field_data&access_token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error(`Meta Lead Ads API error [${response.status}]`);
      const data = await response.json() as { field_data?: unknown };
      fields = { ...fields, ...fieldsToRecord(data.field_data) };
    }

    if (!Object.keys(fields).length && !token) {
      throw new Error('Meta Lead Ads non configurato: impossibile recuperare i dati del lead');
    }

    const fullName = fields.full_name || fields.name || 'Lead Meta';
    const parts = fullName.trim().split(/\s+/);
    const phone = normalizePhone(fields.phone_number || fields.phone);
    const customer = phone
      ? await CustomerRepository.upsertFromExternal({
          phoneE164: phone,
          firstName: fields.first_name || parts[0] || 'Lead',
          lastName: fields.last_name || parts.slice(1).join(' ') || 'Meta',
          email: fields.email || null,
          privacyConsent: true,
          marketingConsent: false,
        })
      : await CustomerRepository.create({
          firstName: fields.first_name || parts[0] || 'Lead',
          lastName: fields.last_name || parts.slice(1).join(' ') || 'Meta',
          phone: null,
          email: fields.email || null,
          privacyConsent: true,
          marketingConsent: false,
        });

    await ExternalRefsRepository.upsertRef({
      provider: 'meta',
      entityType: 'customer',
      entityId: customer.id,
      externalId: leadgenId,
      metadata: { source: 'lead_ads' },
    });
  },
};

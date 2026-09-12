import { CustomerRow } from '../../db/supabaseClient';

// =============================================================================
// TURBOBOOKING - GHL CONTACT MAPPER & ANTI-CORRUPTION LAYER
// Rispetta il vincolo GDPR Art. 9: le note tecniche, formule chimiche e patologie
// non escono MAI verso GHL. Allowlist esplicita e non denylist (§04.2, §01.7).
// =============================================================================

export interface GhlContactPayload {
  firstName: string;
  lastName: string;
  phone: string; // Formato E.164
  email?: string;
  tags?: string[];
  customFields: Array<{
    key: string;
    field_value: string | number;
  }>;
}

export interface GhlInboundContactDto {
  id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dnd?: boolean; // Do Not Disturb / Opt-out
  tags?: string[];
  customFields?: Array<{ key: string; value: string }>;
}

export const GhlContactMapper = {
  /**
   * Mappa un cliente TurboBooking verso il payload consentito da GHL.
   * SOLO i campi in allowlist vengono esportati.
   */
  toGhlContact(
    customer: CustomerRow,
    extraMetrics?: {
      lastVisit?: string;
      visitsCount?: number;
      avgTicketCents?: number;
      preferredStaffName?: string;
      nextAppointment?: string;
      segmentTag?: string; // es: tb_segment_champion
      venueName?: string;
    }
  ): GhlContactPayload {
    const customFields: Array<{ key: string; field_value: string | number }> = [
      { key: 'tb_customer_id', field_value: customer.id },
    ];

    if (extraMetrics?.lastVisit) {
      customFields.push({ key: 'tb_last_visit', field_value: extraMetrics.lastVisit });
    }
    if (extraMetrics?.visitsCount !== undefined) {
      customFields.push({ key: 'tb_visits_count', field_value: extraMetrics.visitsCount });
    }
    if (extraMetrics?.avgTicketCents !== undefined) {
      customFields.push({ key: 'tb_avg_ticket', field_value: (extraMetrics.avgTicketCents / 100).toFixed(2) });
    }
    if (extraMetrics?.preferredStaffName) {
      customFields.push({ key: 'tb_preferred_staff', field_value: extraMetrics.preferredStaffName });
    }
    if (extraMetrics?.nextAppointment) {
      customFields.push({ key: 'tb_next_appointment', field_value: extraMetrics.nextAppointment });
    }
    if (extraMetrics?.venueName) {
      customFields.push({ key: 'tb_venue', field_value: extraMetrics.venueName });
    }

    const tags: string[] = [];
    if (extraMetrics?.segmentTag) {
      tags.push(extraMetrics.segmentTag);
    }
    if (!customer.marketing_consent) {
      tags.push('tb_marketing_optout');
    }

    return {
      firstName: customer.first_name,
      lastName: customer.last_name || '',
      phone: customer.phone_e164 || customer.phone || '',
      email: customer.email || undefined,
      tags,
      customFields,
    };
  },

  /**
   * Mappa un contatto in ingresso da GHL verso l'anagrafica TB.
   * Regola di privacy: un DND/opt-out da GHL vince sempre (marketing_consent = false).
   */
  toTbCustomerInput(dto: GhlInboundContactDto) {
    if (!dto.phone) {
      throw new Error('GHL Inbound Contact: phone_e164 mancante, deduplica impossibile.');
    }

    // Normalizzazione standard E.164 (+39...)
    const cleanPhone = dto.phone.startsWith('+') ? dto.phone : `+${dto.phone.replace(/\D/g, '')}`;

    return {
      phoneE164: cleanPhone,
      firstName: dto.firstName || 'Cliente',
      lastName: dto.lastName || 'GHL',
      email: dto.email || null,
      marketingConsent: dto.dnd === true ? false : undefined,
      privacyConsent: true,
      ghlContactId: dto.id,
    };
  },
};

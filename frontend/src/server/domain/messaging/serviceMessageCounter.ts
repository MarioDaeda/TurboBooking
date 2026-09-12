// =============================================================================
// TURBOBOOKING - CONTATORE SERVICE MESSAGE WHATSAPP (§2, §3.5)
// Dal 1/10/2026 le risposte dentro finestra 24h sono gratuite fino a 1.000/mese PER NUMERO.
// Il conteggio legge pricing.category dai webhook di stato Meta.
// =============================================================================

export const FREE_SERVICE_MESSAGES_PER_MONTH = 1000;
const WARNING_THRESHOLD = 900;

const monthlyCounts = new Map<string, number>();
const countedMessageIds = new Set<string>();

function monthKey(phoneNumberId: string, date = new Date()): string {
  const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${phoneNumberId}:${month}`;
}

export const ServiceMessageCounter = {
  /**
   * Registra un messaggio in uscita. Meta invia più stati (sent/delivered/read) per lo stesso
   * messaggio: si conta una sola volta per messageId.
   */
  record({
    phoneNumberId,
    messageId,
    pricingCategory,
  }: {
    phoneNumberId: string;
    messageId: string;
    pricingCategory?: string;
  }): void {
    if (pricingCategory !== 'service' || countedMessageIds.has(messageId)) {
      return;
    }
    countedMessageIds.add(messageId);

    const key = monthKey(phoneNumberId);
    const count = (monthlyCounts.get(key) || 0) + 1;
    monthlyCounts.set(key, count);

    if (count === WARNING_THRESHOLD) {
      console.warn(`[WhatsApp] Numero ${phoneNumberId}: ${count}/${FREE_SERVICE_MESSAGES_PER_MONTH} service message gratuiti usati questo mese.`);
    } else if (count === FREE_SERVICE_MESSAGES_PER_MONTH + 1) {
      console.warn(`[WhatsApp] Numero ${phoneNumberId}: superata la soglia gratuita di ${FREE_SERVICE_MESSAGES_PER_MONTH} service message/mese, i successivi sono a pagamento.`);
    }
  },

  getMonthlyCount(phoneNumberId: string): { count: number; threshold: number; nearThreshold: boolean; overThreshold: boolean } {
    const count = monthlyCounts.get(monthKey(phoneNumberId)) || 0;
    return {
      count,
      threshold: FREE_SERVICE_MESSAGES_PER_MONTH,
      nearThreshold: count >= WARNING_THRESHOLD,
      overThreshold: count > FREE_SERVICE_MESSAGES_PER_MONTH,
    };
  },
};

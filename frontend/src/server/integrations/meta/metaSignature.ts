import { createHmac, timingSafeEqual } from 'crypto';

// =============================================================================
// TURBOBOOKING - META WEBHOOK SIGNATURE & CHALLENGE HANDSHAKE
// Verifica x-hub-signature-256 e gestione del token di verifica Meta
// =============================================================================

export const MetaSignature = {
  /**
   * Gestisce l'handshake di verifica iniziale inviato da Meta (GET request)
   * Parametri di query: hub.mode, hub.verify_token, hub.challenge
   */
  verifyWebhookChallenge(
    mode: string | null,
    verifyToken: string | null,
    challenge: string | null
  ): { isValid: boolean; challenge: string | null } {
    const expectedToken = process.env.META_VERIFY_TOKEN;

    if (mode === 'subscribe') {
      if ((!expectedToken || expectedToken.includes('your-')) &&
          (process.env.NODE_ENV === 'test' ||
            (process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_WEBHOOKS === 'true'))) {
        return { isValid: true, challenge };
      }

      if (verifyToken === expectedToken) {
        return { isValid: true, challenge };
      }
    }

    return { isValid: false, challenge: null };
  },

  /**
   * Verifica la firma crittografica HMAC-SHA256 del payload inviato da Meta (POST request)
   * Header: x-hub-signature-256 (es. "sha256=abcdef123...")
   */
  verifyPayloadSignature(rawBody: string, signatureHeader?: string | null): boolean {
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret || appSecret.includes('your-')) {
      return process.env.NODE_ENV === 'test' ||
        (process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_WEBHOOKS === 'true');
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    try {
      const signatureHash = signatureHeader.slice(7);
      const hmac = createHmac('sha256', appSecret);
      const calculatedDigest = hmac.update(rawBody).digest('hex');

      const expectedBuffer = Buffer.from(calculatedDigest, 'utf8');
      const actualBuffer = Buffer.from(signatureHash, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  },
};

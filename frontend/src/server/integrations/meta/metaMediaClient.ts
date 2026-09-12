// =============================================================================
// TURBOBOOKING - META MEDIA CLIENT (WHATSAPP CLOUD API)
// Scarica i media inviati dal cliente (es. foto di riferimento taglio) per l'input multimodale
// =============================================================================

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export const MetaMediaClient = {
  /**
   * Due passaggi: GET /{media-id} restituisce un URL temporaneo, poi GET dell'URL (con token) per i byte.
   */
  async fetchMediaAsBase64(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
    const token = process.env.META_WHATSAPP_TOKEN;
    if (!token || token.includes('your-')) {
      return null;
    }

    try {
      const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!metaRes.ok) {
        return null;
      }
      const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
      if (!meta.url) {
        return null;
      }

      const binRes = await fetch(meta.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!binRes.ok) {
        return null;
      }

      const buffer = Buffer.from(await binRes.arrayBuffer());
      return {
        base64: buffer.toString('base64'),
        mimeType: meta.mime_type || binRes.headers.get('content-type') || 'image/jpeg',
      };
    } catch {
      return null;
    }
  },
};

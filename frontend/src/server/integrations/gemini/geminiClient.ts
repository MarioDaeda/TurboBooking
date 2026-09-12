// =============================================================================
// TURBOBOOKING - GEMINI API CLIENT
// Chiamate REST verso Gemini con function-calling; fallback 3.5 Flash-Lite -> 3.8 Flash (§3.6)
// =============================================================================

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface GeminiContent {
  role: 'user' | 'model' | 'function';
  parts: GeminiPart[];
}

export interface GeminiGenerateParams {
  systemInstruction: string;
  contents: GeminiContent[];
  tools: GeminiFunctionDeclaration[];
}

export interface GeminiGenerateResult {
  text: string | null;
  functionCall: { name: string; args: Record<string, unknown> } | null;
  modelUsed: string;
  refusal: boolean;
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const GeminiClient = {
  isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key && !key.includes('your-'));
  },

  /**
   * Genera una risposta provando prima il modello primario (3.5 Flash-Lite) e,
   * solo in caso di errore/esito inaffidabile, ritenta una volta col modello di fallback (3.8 Flash).
   */
  async generate(params: GeminiGenerateParams): Promise<GeminiGenerateResult> {
    const primaryModel = process.env.GEMINI_MODEL_PRIMARY || 'gemini-3.5-flash-lite';
    const fallbackModel = process.env.GEMINI_MODEL_FALLBACK || 'gemini-3.8-flash';

    if (!this.isConfigured()) {
      return {
        text: 'Il servizio di prenotazione via WhatsApp non è ancora attivo su questo numero. Ti risponderà a breve un operatore.',
        functionCall: null,
        modelUsed: 'mock',
        refusal: false,
      };
    }

    try {
      const primary = await this.callModel(primaryModel, params);
      if (!primary.refusal) {
        return primary;
      }
    } catch {
      // si passa al modello di fallback
    }

    try {
      return await this.callModel(fallbackModel, params);
    } catch (fallbackErr: unknown) {
      const errorMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`Gemini generate error su entrambi i modelli (${primaryModel}, ${fallbackModel}): ${errorMsg}`);
    }
  },

  async callModel(model: string, { systemInstruction, contents, tools }: GeminiGenerateParams): Promise<GeminiGenerateResult> {
    const apiKey = process.env.GEMINI_API_KEY;

    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
        contents,
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error [${res.status}] (${model}): ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      throw new Error(`Gemini API: nessun candidate nella risposta (${model})`);
    }

    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
      return { text: null, functionCall: null, modelUsed: model, refusal: true };
    }

    const parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> =
      candidate.content?.parts || [];

    const functionCallPart = parts.find((p) => p.functionCall);
    const textPart = parts.find((p) => p.text);

    return {
      text: textPart?.text || null,
      functionCall: functionCallPart?.functionCall || null,
      modelUsed: model,
      refusal: false,
    };
  },
};

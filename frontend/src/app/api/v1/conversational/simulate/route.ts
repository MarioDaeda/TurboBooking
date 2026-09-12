import { NextRequest, NextResponse } from 'next/server';
import { ConversationalAgentEngine } from '@/server/domain/conversational/conversationalAgentEngine';
import { InboundMessageEvent } from '@/server/domain/conversational/conversationalTypes';

// =============================================================================
// TURBOBOOKING - CONVERSATIONAL AGENT TEST SIMULATOR
// Permette di testare l'unica logica conversazionale (Meta AI / GHL / BetterCallQ)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message = '',
      channel = 'whatsapp',
      provider = 'meta',
      phone = '+393401234567',
      senderName = 'Chiara Ferrandi',
      imageBase64,
      imageMimeType,
    } = body;

    if (typeof message !== 'string' || (!message && !imageBase64)) {
      return NextResponse.json({ error: 'Serve "message" oppure "imageBase64"' }, { status: 400 });
    }

    const inboundEvent: InboundMessageEvent = {
      provider: provider === 'ghl' ? 'ghl' : 'meta',
      channel: channel as InboundMessageEvent['channel'],
      senderId: phone.replace(/\+/g, ''),
      senderPhoneE164: phone,
      senderName,
      text: message,
      imageBase64,
      imageMimeType,
      timestamp: Date.now(),
      rawPayload: { simulated: true },
    };

    const result = await ConversationalAgentEngine.processInboundMessage(inboundEvent);

    return NextResponse.json({
      success: true,
      result,
      simulatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

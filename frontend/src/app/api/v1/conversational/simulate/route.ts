import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { NextRequest, NextResponse } from 'next/server';
import { ConversationalAgentEngine } from '@/server/domain/conversational/conversationalAgentEngine';
import { InboundMessageEvent } from '@/server/domain/conversational/conversationalTypes';
import { apiError, readBody } from '@/server/http/api';

// =============================================================================
// TURBOBOOKING - CONVERSATIONAL AGENT TEST SIMULATOR
// Permette di testare l'unica logica conversazionale (Meta AI / GHL / BetterCallQ)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await readBody(request);
    const message = body.message;
    const channel = typeof body.channel === 'string' ? body.channel : 'whatsapp';
    const provider = typeof body.provider === 'string' ? body.provider : 'meta';
    const phone = typeof body.phone === 'string' ? body.phone : '+393401234567';
    const senderName = typeof body.senderName === 'string' ? body.senderName : 'Chiara Ferrandi';

    if (!message || typeof message !== 'string') {
      throw new Error('TB_INVALID_REQUEST');
    }

    const inboundEvent: InboundMessageEvent = {
      provider: provider === 'ghl' ? 'ghl' : 'meta',
      channel: channel as InboundMessageEvent['channel'],
      senderId: phone.replace(/\+/g, ''),
      senderPhoneE164: phone,
      senderName,
      text: message,
      timestamp: Date.now(),
      rawPayload: { simulated: true },
    };

    const result = await ConversationalAgentEngine.processInboundMessage(inboundEvent);

    return NextResponse.json({
      success: true,
      result,
      simulatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}

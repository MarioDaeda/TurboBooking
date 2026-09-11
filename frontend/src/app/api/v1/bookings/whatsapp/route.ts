import { NextResponse } from 'next/server';
import { WhatsAppBookingStore } from '@/server/domain/booking/whatsappBookingStore';

// Appuntamenti creati via WhatsApp: l'agenda li interroga periodicamente
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ appointments: WhatsAppBookingStore.list() });
}

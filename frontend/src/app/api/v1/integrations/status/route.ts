import { apiError } from '@/server/http/api';
import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdminClient,
  InboundWebhookRow,
  NotificationMessageRow,
} from '@/server/db/supabaseClient';
import { InboundWebhookRepository, NotificationRepository } from '@/server/db/repositories';

// =============================================================================
// TURBOBOOKING - INTEGRATIONS STATUS & HEALTH CHECK (§04.7 regola 5)
// =============================================================================

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let isSupabaseConnected = false;
  let supabaseDetails = '';

  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = getSupabaseAdminClient();
    isSupabaseConnected = Boolean(supabase);
    supabaseDetails = 'Connesso a Supabase PostgreSQL 16 con client server-only';
  } catch (err: unknown) {
    return apiError(err);
  }

  const isGhlConfigured = Boolean(
    process.env.GHL_CLIENT_ID && !process.env.GHL_CLIENT_ID.includes('your-')
  );

  const isMetaConfigured = Boolean(
    process.env.META_VERIFY_TOKEN && !process.env.META_VERIFY_TOKEN.includes('your-')
  );

  let recentWebhooks: InboundWebhookRow[] = [];
  let recentNotifications: NotificationMessageRow[] = [];
  if (isSupabaseConnected) {
    try {
      recentWebhooks = await InboundWebhookRepository.listRecent(10);
      recentNotifications = await NotificationRepository.listRecent(10);
    } catch {
      // Tabella non ancora presente
    }
  }

  return NextResponse.json({
    status: isSupabaseConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    providers: {
      supabase: {
        connected: isSupabaseConnected,
        mode: isSupabaseConnected ? 'production_db' : 'unconfigured_error',
        details: supabaseDetails,
      },
      ghl: {
        configured: isGhlConfigured,
        webhookUrl: '/api/webhooks/ghl',
        features: ['conversations_adapter', 'contacts_bidirectional_sync', 'gdpr_allowlist'],
      },
      meta: {
        configured: isMetaConfigured,
        webhookUrl: '/api/webhooks/meta',
        features: ['whatsapp_cloud_api', 'instagram_direct', 'messenger', 'lead_ads', 'conversational_ai'],
      },
    },
    metrics: {
      totalRecentWebhooks: recentWebhooks.length,
      totalRecentNotifications: recentNotifications.length,
    },
    recentWebhooks,
    recentNotifications,
  });
}

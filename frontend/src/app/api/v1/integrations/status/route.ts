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
  let integrationTablesReady = false;
  let integrationError: string | null = null;

  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('services').select('id').limit(1);
    if (error) throw error;
    isSupabaseConnected = true;
    supabaseDetails = 'Query Supabase completata con client server-only';
  } catch (err: unknown) {
    return apiError(err);
  }

  const isGhlConfigured = Boolean(
    process.env.GHL_LOCATION_ID && process.env.GHL_LOCATION_TOKEN
  );

  const isMetaConfigured = Boolean(
    process.env.META_VERIFY_TOKEN && !process.env.META_VERIFY_TOKEN.includes('your-') &&
    process.env.META_APP_SECRET && !process.env.META_APP_SECRET.includes('your-') &&
    process.env.META_WHATSAPP_TOKEN && !process.env.META_WHATSAPP_TOKEN.includes('your-') &&
    process.env.META_WHATSAPP_PHONE_NUMBER_ID
  );

  let recentWebhooks: InboundWebhookRow[] = [];
  let recentNotifications: NotificationMessageRow[] = [];
  if (isSupabaseConnected) {
    try {
      recentWebhooks = await InboundWebhookRepository.listRecent(10);
      recentNotifications = await NotificationRepository.listRecent(10);
      integrationTablesReady = true;
    } catch (err: unknown) {
      integrationError = err instanceof Error ? err.message : String(err);
    }
  }

  const overallHealthy = isSupabaseConnected && integrationTablesReady;

  return NextResponse.json({
    status: overallHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    providers: {
      supabase: {
        connected: isSupabaseConnected,
        mode: isSupabaseConnected ? 'production_db' : 'unconfigured_error',
        details: supabaseDetails,
      },
      integrationStorage: {
        ready: integrationTablesReady,
        error: integrationError,
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

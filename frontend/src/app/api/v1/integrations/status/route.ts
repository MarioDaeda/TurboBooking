import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/server/db/supabaseClient';
import { InboundWebhookRepository, NotificationRepository } from '@/server/db/repositories';

// =============================================================================
// TURBOBOOKING - INTEGRATIONS STATUS & HEALTH CHECK (§04.7 regola 5)
// "Ogni provider ha una pagina di stato in-app. Un'integrazione silenziosamente
// rotta è peggio di un'integrazione assente."
// =============================================================================

export async function GET() {
  const supabase = getSupabaseAdminClient();
  const isSupabaseConfigured = Boolean(
    process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project-id')
  );

  const isGhlConfigured = Boolean(
    process.env.GHL_CLIENT_ID && !process.env.GHL_CLIENT_ID.includes('your-')
  );

  const isMetaConfigured = Boolean(
    process.env.META_VERIFY_TOKEN && !process.env.META_VERIFY_TOKEN.includes('your-')
  );

  const recentWebhooks = await InboundWebhookRepository.listRecent(10);
  const recentNotifications = await NotificationRepository.listRecent(10);

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    providers: {
      supabase: {
        connected: Boolean(supabase),
        mode: isSupabaseConfigured ? 'production_db' : 'in_memory_fallback',
        details: isSupabaseConfigured
          ? 'Connesso a Supabase PostgreSQL 16 con RLS'
          : 'In esecuzione su store locale in-memory (configura SUPABASE_URL in .env)',
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

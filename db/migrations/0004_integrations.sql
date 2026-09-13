-- Tabelle operative per webhook, riferimenti provider e notifiche.
-- Sono server-only: anon/authenticated non hanno accesso diretto; il backend usa service_role.

CREATE TABLE public.inbound_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('ghl', 'meta', 'google', 'stripe', 'bettercallq')),
  external_id text NOT NULL,
  signature_valid boolean NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz,
  error text,
  CONSTRAINT inbound_webhooks_provider_external_id_key UNIQUE (provider, external_id)
);

CREATE INDEX inbound_webhooks_received_at_idx
  ON public.inbound_webhooks (received_at DESC);
CREATE INDEX inbound_webhooks_pending_idx
  ON public.inbound_webhooks (received_at)
  WHERE processed_at IS NULL;

CREATE TABLE public.external_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('ghl', 'meta', 'google', 'stripe')),
  entity_type text NOT NULL CHECK (entity_type IN ('customer', 'appointment', 'venue', 'staff')),
  entity_id uuid NOT NULL,
  external_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz,
  sync_state text NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('ok', 'pending', 'error')),
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT external_refs_provider_external_key UNIQUE (provider, entity_type, external_id),
  CONSTRAINT external_refs_provider_entity_key UNIQUE (provider, entity_type, entity_id)
);

CREATE INDEX external_refs_entity_idx
  ON public.external_refs (entity_type, entity_id);

CREATE TABLE public.notification_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp', 'instagram', 'messenger', 'push')),
  provider text NOT NULL CHECK (provider IN ('ghl', 'direct_meta', 'internal')),
  template_key text,
  to_address text NOT NULL,
  body_preview text,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'rejected_no_consent')),
  provider_message_id text,
  error text,
  consent_checked boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT notification_provider_message_key UNIQUE (provider, provider_message_id)
);

CREATE INDEX notification_messages_created_at_idx
  ON public.notification_messages (created_at DESC);
CREATE INDEX notification_messages_status_idx
  ON public.notification_messages (status, scheduled_for);

ALTER TABLE public.inbound_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.inbound_webhooks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.external_refs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.notification_messages FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.inbound_webhooks TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.external_refs TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_messages TO service_role;

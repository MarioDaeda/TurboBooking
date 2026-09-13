-- Forward-only reconciliation of the structural changes reported on Supabase.
-- No environment-specific accounts, memberships or customer data belong here.
BEGIN;

-- Abort atomically if legacy data needs a separate, explicit migration.
ALTER TABLE public.inbound_webhooks
  DROP CONSTRAINT IF EXISTS inbound_webhooks_provider_check;
ALTER TABLE public.inbound_webhooks
  ADD CONSTRAINT inbound_webhooks_provider_check
  CHECK (provider IN ('ghl', 'meta', 'google', 'stripe')) NOT VALID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.inbound_webhooks
    WHERE provider NOT IN ('ghl', 'meta', 'google', 'stripe')
  ) THEN
    ALTER TABLE public.inbound_webhooks VALIDATE CONSTRAINT inbound_webhooks_provider_check;
  ELSE
    RAISE EXCEPTION 'Unsupported historical webhook providers: archive or migrate explicitly before applying 0010';
  END IF;
END;
$$;

ALTER TABLE public.inbound_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;

-- GRANT alone does not remove privileges inherited from Supabase defaults.
REVOKE ALL ON TABLE public.inbound_webhooks, public.external_refs,
  public.notification_messages, public.processed_provider_events,
  public.staff_memberships FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inbound_webhooks,
  public.external_refs, public.notification_messages,
  public.processed_provider_events TO service_role;
GRANT SELECT ON TABLE public.staff_memberships TO service_role;

ALTER FUNCTION public.tb_redact_expired_inbound_webhooks() SECURITY INVOKER;
ALTER FUNCTION public.tb_claim_provider_event(text, text, text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.tb_redact_expired_inbound_webhooks(),
  public.tb_claim_provider_event(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tb_redact_expired_inbound_webhooks(),
  public.tb_claim_provider_event(text, text, text) TO service_role;

CREATE INDEX IF NOT EXISTS notification_messages_customer_id_idx
  ON public.notification_messages (customer_id);
CREATE INDEX IF NOT EXISTS notification_messages_appointment_id_idx
  ON public.notification_messages (appointment_id);
CREATE INDEX IF NOT EXISTS staff_memberships_operator_id_idx
  ON public.staff_memberships (operator_id);

NOTIFY pgrst, 'reload schema';
COMMIT;

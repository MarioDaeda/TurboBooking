-- Retention di 30 giorni per il payload raw webhook. La funzione redige il
-- contenuto mantenendo il record diagnostico e il suo lifecycle.
BEGIN;

ALTER TABLE public.inbound_webhooks
  ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz
    DEFAULT (clock_timestamp() + interval '30 days');

CREATE INDEX IF NOT EXISTS inbound_webhooks_retention_idx
  ON public.inbound_webhooks (retention_expires_at)
  WHERE payload <> '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.tb_redact_expired_inbound_webhooks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.inbound_webhooks
  SET payload = '{}'::jsonb,
      retention_expires_at = NULL
  WHERE retention_expires_at <= clock_timestamp()
    AND payload <> '{}'::jsonb;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.tb_redact_expired_inbound_webhooks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tb_redact_expired_inbound_webhooks() TO service_role;

COMMIT;

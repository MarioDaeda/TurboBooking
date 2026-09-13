-- Idempotenza a granularità di singolo evento provider. Consente di riprendere
-- un webhook Meta parzialmente elaborato senza duplicare messaggi già conclusi.
BEGIN;

CREATE TABLE public.processed_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  external_id text NOT NULL,
  processing_status text NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing', 'processed', 'failed')),
  processing_started_at timestamptz,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (provider, event_type, external_id)
);

CREATE INDEX processed_provider_events_status_idx
  ON public.processed_provider_events (processing_status, updated_at);

REVOKE ALL ON TABLE public.processed_provider_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.processed_provider_events TO service_role;

CREATE OR REPLACE FUNCTION public.tb_claim_provider_event(
  p_provider text,
  p_event_type text,
  p_external_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed_id uuid;
BEGIN
  IF nullif(btrim(p_provider), '') IS NULL
     OR nullif(btrim(p_event_type), '') IS NULL
     OR nullif(btrim(p_external_id), '') IS NULL THEN
    RAISE EXCEPTION 'TB_PROVIDER_EVENT_ID_REQUIRED';
  END IF;

  INSERT INTO public.processed_provider_events (
    provider, event_type, external_id, processing_status, processing_started_at
  ) VALUES (
    p_provider, p_event_type, p_external_id, 'processing', clock_timestamp()
  )
  ON CONFLICT (provider, event_type, external_id) DO NOTHING
  RETURNING id INTO claimed_id;

  IF claimed_id IS NOT NULL THEN
    RETURN true;
  END IF;

  UPDATE public.processed_provider_events
  SET processing_status = 'processing',
      processing_started_at = clock_timestamp(),
      processed_at = NULL,
      error = NULL,
      updated_at = clock_timestamp()
  WHERE provider = p_provider
    AND event_type = p_event_type
    AND external_id = p_external_id
    AND (
      processing_status = 'failed'
      OR (
        processing_status = 'processing'
        AND processing_started_at < clock_timestamp() - interval '5 minutes'
      )
    )
  RETURNING id INTO claimed_id;

  RETURN claimed_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.tb_claim_provider_event(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tb_claim_provider_event(text, text, text)
  TO service_role;

COMMIT;

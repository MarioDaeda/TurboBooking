-- Lifecycle atomico dei webhook: un record pending/failed può essere reclamato;
-- un record processed non viene rielaborato.
BEGIN;

ALTER TABLE public.inbound_webhooks
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed')),
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

UPDATE public.inbound_webhooks
SET processing_status = CASE
  WHEN processed_at IS NOT NULL AND error IS NULL THEN 'processed'
  WHEN processed_at IS NOT NULL AND error IS NOT NULL THEN 'failed'
  ELSE 'pending'
END
WHERE processing_status = 'pending';

CREATE INDEX IF NOT EXISTS inbound_webhooks_processing_idx
  ON public.inbound_webhooks (processing_status, received_at);

COMMIT;

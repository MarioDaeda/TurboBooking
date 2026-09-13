-- Consensi espliciti del cliente, persistiti server-side.
BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS has_privacy_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

COMMIT;

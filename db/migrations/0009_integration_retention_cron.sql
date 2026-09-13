-- Allinea i record preesistenti ai 30 giorni dalla ricezione e programma la
-- redazione giornaliera quando pg_cron è disponibile nell'ambiente PostgreSQL.
BEGIN;

UPDATE public.inbound_webhooks
SET retention_expires_at = received_at + interval '30 days'
WHERE retention_expires_at IS NULL
   OR retention_expires_at > received_at + interval '30 days';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_available_extensions WHERE name = 'pg_cron'
  ) THEN
    BEGIN
      -- pg_cron crea e gestisce autonomamente lo schema cron.
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron non attivabile automaticamente: %', SQLERRM;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron'
  ) THEN
    EXECUTE $schedule$
      SELECT cron.schedule(
        'tb-redact-webhooks-daily',
        '15 3 * * *',
        'SELECT public.tb_redact_expired_inbound_webhooks();'
      )
    $schedule$;
  ELSE
    RAISE NOTICE 'pg_cron non disponibile: configurare uno scheduler esterno giornaliero';
  END IF;
END;
$$;

COMMIT;

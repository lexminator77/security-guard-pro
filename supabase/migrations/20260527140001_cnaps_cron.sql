-- supabase/migrations/20260527140001_cnaps_cron.sql
-- IMPORTANT: Before applying this migration, replace the two placeholders:
--   TON_PROJECT_REF  → your Supabase project reference (found in Settings → General)
--   TON_CRON_SECRET  → the value of your CRON_SECRET environment variable

-- Active l'extension pg_net si pas encore active (nécessaire pour net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Supprime le job s'il existe déjà (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verify-cnaps-auto') THEN
    PERFORM cron.unschedule('verify-cnaps-auto');
  END IF;
END;
$$;

-- Programme la vérification CNAPS les 1er et 15 de chaque mois à 3h
SELECT cron.schedule(
  'verify-cnaps-auto',
  '0 3 1,15 * *',
  $$
    SELECT net.http_post(
      url        := 'https://TON_PROJECT_REF.supabase.co/functions/v1/verify-cnaps',
      headers    := '{"Content-Type": "application/json", "x-cron-secret": "TON_CRON_SECRET"}'::jsonb,
      body       := '{}'::jsonb
    );
  $$
);

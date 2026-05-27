-- supabase/migrations/20260527140000_cnaps_statut.sql

ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS cnaps_statut TEXT NOT NULL DEFAULT 'inconnu'
    CHECK (cnaps_statut IN ('vert', 'rouge', 'a_verifier', 'inconnu')),
  ADD COLUMN IF NOT EXISTS cnaps_last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cnaps_last_result TEXT;

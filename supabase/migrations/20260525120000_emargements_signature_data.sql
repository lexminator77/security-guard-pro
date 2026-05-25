-- supabase/migrations/20260525120000_emargements_signature_data.sql
ALTER TABLE public.emargements_stagiaire
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

ALTER TABLE public.emargements_formateur
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- supabase/migrations/20260525100000_stagiaires_auth_user_id.sql
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- supabase/migrations/20260524140000_questionnaire_tokens.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'questionnaire_type') THEN
    CREATE TYPE public.questionnaire_type AS ENUM (
      'positionnement',
      'satisfaction_chaud',
      'satisfaction_froid'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.questionnaire_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token          uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  formation_id   uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id   uuid NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,
  type           public.questionnaire_type NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  reponses       jsonb,
  UNIQUE(formation_id, stagiaire_id, type)
);

ALTER TABLE public.questionnaire_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qt_admin_all ON public.questionnaire_tokens;
CREATE POLICY qt_admin_all ON public.questionnaire_tokens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'));

-- supabase/migrations/20260524140001_reclamations.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reclamation_demandeur_type') THEN
    CREATE TYPE public.reclamation_demandeur_type AS ENUM ('stagiaire', 'entreprise', 'autre');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reclamation_statut') THEN
    CREATE TYPE public.reclamation_statut AS ENUM ('ouverte', 'en_cours', 'cloturee');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reclamations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_reclamation date NOT NULL DEFAULT CURRENT_DATE,
  demandeur_nom    text NOT NULL,
  demandeur_type   public.reclamation_demandeur_type NOT NULL,
  objet            text NOT NULL,
  description      text NOT NULL,
  statut           public.reclamation_statut NOT NULL DEFAULT 'ouverte',
  reponse          text,
  date_cloture     date,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reclamations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_admin_all ON public.reclamations;
CREATE POLICY rec_admin_all ON public.reclamations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'));

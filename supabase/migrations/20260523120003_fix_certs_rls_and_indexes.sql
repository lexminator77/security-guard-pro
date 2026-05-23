-- Bridge function: returns the stagiaire.id for the currently authenticated user
-- by joining auth.uid() → profiles.email → stagiaires.email → stagiaires.id
CREATE OR REPLACE FUNCTION public.get_own_stagiaire_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.stagiaires s
  JOIN public.profiles p ON p.email = s.email
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- Fix certifications SELECT policy: scope to own stagiaire record OR staff roles
DROP POLICY IF EXISTS certs_select_auth ON public.certifications;

CREATE POLICY certs_select_auth ON public.certifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
    OR public.has_role(auth.uid(), 'formateur')
    OR stagiaire_id = public.get_own_stagiaire_id()
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_certifications_stagiaire_id ON public.certifications(stagiaire_id);
CREATE INDEX IF NOT EXISTS idx_certifications_date_expiration ON public.certifications(date_expiration);
CREATE INDEX IF NOT EXISTS idx_notifications_destinataire_id ON public.notifications(destinataire_id);
CREATE INDEX IF NOT EXISTS idx_notifications_certification_id ON public.notifications(certification_id);

-- Also fix NOT NULL on timestamp columns (cosmetic but consistent with project pattern)
ALTER TABLE public.certifications
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.notifications
  ALTER COLUMN created_at SET NOT NULL;

-- Fix certifications SELECT policy to allow stagiaire-role users to read their certifications
DROP POLICY IF EXISTS certs_select_auth ON public.certifications;

CREATE POLICY certs_select_auth ON public.certifications
  FOR SELECT TO authenticated
  USING (true);

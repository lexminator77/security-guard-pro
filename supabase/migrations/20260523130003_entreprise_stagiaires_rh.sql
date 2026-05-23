-- Only add if RLS is enabled on entreprise_stagiaires and rh role has no SELECT access
CREATE POLICY IF NOT EXISTS es_select_rh ON public.entreprise_stagiaires
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rh')
    AND entreprise_id = public.get_rh_entreprise_id()
  );

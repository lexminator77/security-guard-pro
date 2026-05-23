-- certifications: RH sees certs for their company's agents
DROP POLICY IF EXISTS certs_select_rh ON public.certifications;
CREATE POLICY certs_select_rh ON public.certifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rh')
    AND stagiaire_id IN (
      SELECT stagiaire_id FROM public.entreprise_stagiaires
      WHERE entreprise_id = public.get_rh_entreprise_id()
    )
  );

-- formation_participants: RH sees participations for their company's agents
DROP POLICY IF EXISTS fp_select_rh ON public.formation_participants;
CREATE POLICY fp_select_rh ON public.formation_participants
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rh')
    AND stagiaire_id IN (
      SELECT stagiaire_id FROM public.entreprise_stagiaires
      WHERE entreprise_id = public.get_rh_entreprise_id()
    )
  );

-- stagiaire_documents: RH sees documents for their company's agents
DROP POLICY IF EXISTS sd_select_rh ON public.stagiaire_documents;
CREATE POLICY sd_select_rh ON public.stagiaire_documents
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rh')
    AND stagiaire_id IN (
      SELECT stagiaire_id FROM public.entreprise_stagiaires
      WHERE entreprise_id = public.get_rh_entreprise_id()
    )
  );

-- stagiaires: RH sees their company's agents
DROP POLICY IF EXISTS stagiaires_select_rh ON public.stagiaires;
CREATE POLICY stagiaires_select_rh ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rh')
    AND id IN (
      SELECT stagiaire_id FROM public.entreprise_stagiaires
      WHERE entreprise_id = public.get_rh_entreprise_id()
    )
  );

-- entreprises: RH sees their own company
DROP POLICY IF EXISTS entreprises_select_rh ON public.entreprises;
CREATE POLICY entreprises_select_rh ON public.entreprises
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rh')
    AND id = public.get_rh_entreprise_id()
  );

-- formations: RH sees formations linked to their agents
DROP POLICY IF EXISTS formations_select_rh ON public.formations;
CREATE POLICY formations_select_rh ON public.formations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rh')
    AND id IN (
      SELECT formation_id FROM public.formation_participants
      WHERE stagiaire_id IN (
        SELECT stagiaire_id FROM public.entreprise_stagiaires
        WHERE entreprise_id = public.get_rh_entreprise_id()
      )
    )
  );

-- Supprimer les anciennes politiques stagiaires
DROP POLICY IF EXISTS "stagiaires_select_auth"    ON public.stagiaires;
DROP POLICY IF EXISTS "stagiaires_admin_write"     ON public.stagiaires;
DROP POLICY IF EXISTS "stagiaires_formateur_write" ON public.stagiaires;
DROP POLICY IF EXISTS "stagiaires_select_own"      ON public.stagiaires;
DROP POLICY IF EXISTS "stagiaires_select_rh"       ON public.stagiaires;
DROP POLICY IF EXISTS "stag_select_admin"          ON public.stagiaires;
DROP POLICY IF EXISTS "stag_all_admin"             ON public.stagiaires;
DROP POLICY IF EXISTS "stag_select_formateur"      ON public.stagiaires;
DROP POLICY IF EXISTS "stag_insert_formateur"      ON public.stagiaires;
DROP POLICY IF EXISTS "stag_update_formateur"      ON public.stagiaires;
DROP POLICY IF EXISTS "stag_select_own"            ON public.stagiaires;
DROP POLICY IF EXISTS "stag_update_own"            ON public.stagiaires;
DROP POLICY IF EXISTS "stag_select_other_roles"    ON public.stagiaires;

-- Admin / secrétaire : voient TOUT (y compris soft-deleted)
CREATE POLICY "stag_select_admin" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

-- Admin / secrétaire : écrivent tout
CREATE POLICY "stag_all_admin" ON public.stagiaires
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

-- Formateur : SELECT uniquement les non-supprimés du même organisme
CREATE POLICY "stag_select_formateur" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur')
    AND deleted_at IS NULL
    AND organisme_id = public.get_user_organisme_id()
  );

-- Formateur : INSERT
CREATE POLICY "stag_insert_formateur" ON public.stagiaires
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur')
    AND organisme_id = public.get_user_organisme_id()
    AND created_by = auth.uid()
  );

-- Formateur : UPDATE (ses stagiaires ou dans ses formations)
CREATE POLICY "stag_update_formateur" ON public.stagiaires
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur')
    AND deleted_at IS NULL
    AND organisme_id = public.get_user_organisme_id()
    AND (
      created_by = auth.uid()
      OR id IN (
        SELECT fp.stagiaire_id
        FROM public.formation_participants fp
        JOIN public.formations f ON f.id = fp.formation_id
        WHERE f.formateur_id = (
          SELECT fmt.id FROM public.formateurs fmt
          JOIN auth.users u ON u.email = fmt.email
          WHERE u.id = auth.uid()
          LIMIT 1
        )
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur')
    AND organisme_id = public.get_user_organisme_id()
  );

-- Stagiaire connecté : voit sa propre fiche non-supprimée
CREATE POLICY "stag_select_own" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Stagiaire connecté : peut modifier sa propre fiche
CREATE POLICY "stag_update_own" ON public.stagiaires
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (auth_user_id = auth.uid());

-- Agent / RH : lecture seule des non-supprimés de leur organisme
CREATE POLICY "stag_select_other_roles" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'agent')
      OR public.has_role(auth.uid(), 'rh')
    )
    AND deleted_at IS NULL
    AND organisme_id = public.get_user_organisme_id()
  );

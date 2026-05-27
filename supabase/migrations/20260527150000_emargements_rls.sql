-- supabase/migrations/20260527150000_emargements_rls.sql
-- Policies RLS pour emargements_stagiaire et emargements_formateur

-- ── emargements_stagiaire ──────────────────────────────────────────────────

-- SELECT : stagiaire voit ses propres lignes, admin/formateur voient tout
DROP POLICY IF EXISTS em_stag_select ON public.emargements_stagiaire;
CREATE POLICY em_stag_select ON public.emargements_stagiaire
  FOR SELECT USING (
    stagiaire_id IN (
      SELECT id FROM public.stagiaires WHERE auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('administrateur', 'secretaire', 'formateur')
    )
  );

-- INSERT : stagiaire peut insérer ses propres lignes
DROP POLICY IF EXISTS em_stag_insert ON public.emargements_stagiaire;
CREATE POLICY em_stag_insert ON public.emargements_stagiaire
  FOR INSERT WITH CHECK (
    stagiaire_id IN (
      SELECT id FROM public.stagiaires WHERE auth_user_id = auth.uid()
    )
  );

-- UPDATE : admin uniquement (pour corriger en cas d'erreur)
DROP POLICY IF EXISTS em_stag_update ON public.emargements_stagiaire;
CREATE POLICY em_stag_update ON public.emargements_stagiaire
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'administrateur'
    )
  );

-- ── emargements_formateur ──────────────────────────────────────────────────

-- SELECT : formateur/admin/secrétaire voient tout
-- (la table formateurs n'a pas de lien direct vers auth.uid() en prod —
--  on délègue la granularité à l'application comme pour les autres policies formateurs)
DROP POLICY IF EXISTS em_form_select ON public.emargements_formateur;
CREATE POLICY em_form_select ON public.emargements_formateur
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('administrateur', 'secretaire', 'formateur')
    )
  );

-- INSERT : formateur ou admin peut insérer
DROP POLICY IF EXISTS em_form_insert ON public.emargements_formateur;
CREATE POLICY em_form_insert ON public.emargements_formateur
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('administrateur', 'formateur')
    )
  );

-- UPDATE : admin uniquement
DROP POLICY IF EXISTS em_form_update ON public.emargements_formateur;
CREATE POLICY em_form_update ON public.emargements_formateur
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'administrateur'
    )
  );

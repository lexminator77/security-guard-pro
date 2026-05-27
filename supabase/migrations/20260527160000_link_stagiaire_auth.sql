-- supabase/migrations/20260527160000_link_stagiaire_auth.sql
-- Fonction SECURITY DEFINER : lie auth_user_id au stagiaire correspondant par email
-- Appelée depuis EspaceStagiaire au premier login pour que les RLS emargements fonctionnent

CREATE OR REPLACE FUNCTION public.link_stagiaire_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_email  text;
  v_stagiaire_id uuid;
BEGIN
  SELECT email INTO v_auth_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_auth_email IS NULL THEN RETURN; END IF;

  SELECT id INTO v_stagiaire_id
  FROM public.stagiaires
  WHERE email = v_auth_email
    AND (auth_user_id IS NULL OR auth_user_id <> auth.uid());

  IF v_stagiaire_id IS NULL THEN RETURN; END IF;

  UPDATE public.stagiaires
  SET auth_user_id = auth.uid()
  WHERE id = v_stagiaire_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_stagiaire_auth() TO authenticated;

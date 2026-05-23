-- Add rh to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rh';

-- Table linking one auth user to one entreprise
CREATE TABLE IF NOT EXISTS public.entreprise_rh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.entreprise_rh ENABLE ROW LEVEL SECURITY;

-- RH sees their own row
DROP POLICY IF EXISTS erh_select ON public.entreprise_rh;
CREATE POLICY erh_select ON public.entreprise_rh
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin manages everything
DROP POLICY IF EXISTS erh_admin_all ON public.entreprise_rh;
CREATE POLICY erh_admin_all ON public.entreprise_rh
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur'));

-- Bridge function: returns entreprise_id for the current RH user
CREATE OR REPLACE FUNCTION public.get_rh_entreprise_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT entreprise_id
  FROM public.entreprise_rh
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

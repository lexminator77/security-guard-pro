-- ─── Table organismes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organismes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organismes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organismes_select_auth" ON public.organismes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "organismes_admin_write" ON public.organismes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur'));

-- Organisme par défaut (phase test)
INSERT INTO public.organismes (id, nom, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Organisme Principal', 'principal', 'total')
ON CONFLICT (id) DO NOTHING;

-- ─── organisme_id sur profiles ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);

UPDATE public.profiles
  SET organisme_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisme_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_default_organisme()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.organisme_id IS NULL THEN
    NEW.organisme_id := '00000000-0000-0000-0000-000000000001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_default_organisme ON public.profiles;
CREATE TRIGGER trg_default_organisme
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organisme();

-- ─── organisme_id sur les tables métier ──────────────────────────────────
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.stagiaires SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.formations SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

ALTER TABLE public.formateurs
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.formateurs SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

ALTER TABLE public.formation_participants
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.formation_participants SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

-- ─── Soft delete sur stagiaires ───────────────────────────────────────────
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES auth.users(id);

-- ─── Table audit_log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisme_id UUID REFERENCES public.organismes(id),
  user_id      UUID REFERENCES auth.users(id),
  user_role    TEXT NOT NULL,
  action       TEXT NOT NULL,
  table_name   TEXT NOT NULL,
  record_id    UUID NOT NULL,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'));
CREATE POLICY "audit_log_insert_auth" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─── Fonction helper organisme ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_organisme_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organisme_id FROM public.profiles WHERE id = auth.uid()
$$;

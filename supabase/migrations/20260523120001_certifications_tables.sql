-- Table certifications
CREATE TABLE public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stagiaire_id UUID NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date_obtention DATE NOT NULL,
  date_expiration DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stagiaire_id, type)
);

CREATE TRIGGER trg_certifications_updated
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY certs_select_auth ON public.certifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
    OR public.has_role(auth.uid(), 'formateur')
  );

CREATE POLICY certs_write_admin ON public.certifications
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

-- Table notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id UUID NOT NULL,
  destinataire_type TEXT NOT NULL,
  certification_id UUID REFERENCES public.certifications(id) ON DELETE CASCADE,
  type_alerte TEXT NOT NULL,
  email_envoye BOOLEAN DEFAULT false,
  lu BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifs_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (destinataire_id = auth.uid());

CREATE POLICY notifs_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (destinataire_id = auth.uid())
  WITH CHECK (destinataire_id = auth.uid());

CREATE POLICY notifs_admin_all ON public.notifications
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

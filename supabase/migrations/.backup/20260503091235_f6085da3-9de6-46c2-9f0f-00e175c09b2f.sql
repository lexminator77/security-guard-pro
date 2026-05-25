
CREATE TYPE public.participant_status AS ENUM ('inscrit', 'present', 'absent', 'valide', 'echec');

CREATE TABLE public.formation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formation_id UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id UUID NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,
  status public.participant_status NOT NULL DEFAULT 'inscrit',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (formation_id, stagiaire_id)
);

CREATE INDEX idx_fp_formation ON public.formation_participants(formation_id);
CREATE INDEX idx_fp_stagiaire ON public.formation_participants(stagiaire_id);

ALTER TABLE public.formation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_select_auth" ON public.formation_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fp_write_staff" ON public.formation_participants
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'administrateur'::app_role)
    OR has_role(auth.uid(), 'secretaire'::app_role)
    OR has_role(auth.uid(), 'formateur'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'administrateur'::app_role)
    OR has_role(auth.uid(), 'secretaire'::app_role)
    OR has_role(auth.uid(), 'formateur'::app_role)
  );

CREATE TRIGGER trg_fp_updated_at
  BEFORE UPDATE ON public.formation_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

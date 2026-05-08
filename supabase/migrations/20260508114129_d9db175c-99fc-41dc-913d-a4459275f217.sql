
-- Table formateurs
CREATE TABLE public.formateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  carte_pro_number TEXT,
  carte_pro_expiry DATE,
  sst_date DATE,
  sst_expiry DATE,
  tfp_aps_date DATE,
  tfp_aps_expiry DATE,
  mac_aps_date DATE,
  mac_aps_expiry DATE,
  ssiap1_date DATE,
  ssiap1_expiry DATE,
  ssiap2_date DATE,
  ssiap2_expiry DATE,
  ssiap3_date DATE,
  ssiap3_expiry DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_formateurs_updated BEFORE UPDATE ON public.formateurs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.formateurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY formateurs_select_auth ON public.formateurs
FOR SELECT TO authenticated USING (true);

CREATE POLICY formateurs_write_admin ON public.formateurs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'))
WITH CHECK (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'));

-- Stagiaires : ajout MAC
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS mac_aps_date DATE,
  ADD COLUMN IF NOT EXISTS mac_aps_expiry DATE;

-- Journal des rappels emails
CREATE TABLE public.email_reminders_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL, -- 'formateur' | 'stagiaire'
  recipient_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  certification TEXT NOT NULL, -- 'sst' | 'tfp_aps' | 'mac_aps' | 'ssiap1' | 'ssiap2' | 'ssiap3' | 'carte_pro'
  months_before INT NOT NULL, -- 6, 3, 1
  expiry_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipient_type, recipient_id, certification, months_before, expiry_date)
);

ALTER TABLE public.email_reminders_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminders_select_admin ON public.email_reminders_log
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'administrateur'));

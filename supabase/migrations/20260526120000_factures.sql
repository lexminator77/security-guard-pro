-- supabase/migrations/20260526120000_factures.sql

CREATE OR REPLACE FUNCTION public.generate_facture_numero()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  next_num INT;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(numero, '-', 3) AS INT)), 0
  ) + 1
  INTO next_num
  FROM public.factures
  WHERE SPLIT_PART(numero, '-', 2) = year_str;
  RETURN 'FACT-' || year_str || '-' || lpad(next_num::text, 3, '0');
END;
$$;

CREATE TABLE public.factures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL UNIQUE DEFAULT public.generate_facture_numero(),
  formation_id     UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  client_nom       TEXT NOT NULL,
  client_adresse   TEXT,
  client_siret     TEXT,
  montant_ht       NUMERIC(10,2) NOT NULL DEFAULT 0,
  participant_count INT NOT NULL DEFAULT 0,
  statut           TEXT NOT NULL DEFAULT 'brouillon'
                     CHECK (statut IN ('brouillon', 'envoye', 'paye')),
  date_emission    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_secretaire_factures" ON public.factures
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'secretaire')
    )
  );

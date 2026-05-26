-- supabase/migrations/20260526130000_financements_opco.sql

CREATE TABLE public.financements_opco (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id        UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id        UUID REFERENCES public.stagiaires(id) ON DELETE SET NULL,

  opco_nom            TEXT NOT NULL,
  opco_contact_nom    TEXT,
  opco_contact_email  TEXT,
  opco_contact_tel    TEXT,
  numero_dossier      TEXT,

  montant_accorde     NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_paye        NUMERIC(10,2) NOT NULL DEFAULT 0,
  facture_id          UUID REFERENCES public.factures(id) ON DELETE SET NULL,

  statut              TEXT NOT NULL DEFAULT 'brouillon'
                        CHECK (statut IN (
                          'brouillon', 'demande_envoyee', 'accord_recu',
                          'en_attente_facture', 'facture', 'paye', 'refuse'
                        )),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.financements_opco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_secretaire_financements_opco" ON public.financements_opco
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

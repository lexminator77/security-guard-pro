CREATE TABLE public.financements_cpf (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id        UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id        UUID NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,

  numero_dossier_cpf  TEXT,
  code_formation_cpf  TEXT,
  montant_cpf         NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_paye        NUMERIC(10,2) NOT NULL DEFAULT 0,

  statut              TEXT NOT NULL DEFAULT 'demande_envoyee'
                        CHECK (statut IN ('demande_envoyee', 'accord_recu', 'paye', 'refuse')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.financements_cpf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_secretaire_financements_cpf" ON public.financements_cpf
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

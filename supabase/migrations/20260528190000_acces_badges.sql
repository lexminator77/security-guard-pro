-- ─── Registre visiteurs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.registre_visiteurs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisme_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  formateur_id   UUID REFERENCES public.formateurs(id) ON DELETE SET NULL,
  nom            TEXT NOT NULL,
  prenom         TEXT NOT NULL,
  entreprise     TEXT,
  motif          TEXT,
  badge_numero   TEXT,
  cle_numero     TEXT,
  heure_entree   TIMESTAMPTZ NOT NULL DEFAULT now(),
  heure_sortie   TIMESTAMPTZ,
  statut         TEXT NOT NULL DEFAULT 'present' CHECK (statut IN ('present', 'sorti')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.registre_visiteurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acces_visiteurs_auth" ON public.registre_visiteurs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Inventaire clés ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventaire_cles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisme_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  formateur_id   UUID REFERENCES public.formateurs(id) ON DELETE SET NULL,
  numero         TEXT NOT NULL,
  designation    TEXT NOT NULL,
  statut         TEXT NOT NULL DEFAULT 'disponible' CHECK (statut IN ('disponible', 'remise', 'perdue')),
  remis_a        TEXT,
  remis_le       TIMESTAMPTZ,
  rendu_le       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventaire_cles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acces_cles_auth" ON public.inventaire_cles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Inventaire badges ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventaire_badges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisme_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  formateur_id   UUID REFERENCES public.formateurs(id) ON DELETE SET NULL,
  numero         TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('visiteur', 'employe', 'ouvrier')),
  designation    TEXT NOT NULL,
  statut         TEXT NOT NULL DEFAULT 'disponible' CHECK (statut IN ('disponible', 'attribue', 'perdu')),
  attribue_a     TEXT,
  attribue_le    TIMESTAMPTZ,
  rendu_le       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventaire_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acces_badges_auth" ON public.inventaire_badges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add per-person price and pack support to formation_templates
ALTER TABLE public.formation_templates
  ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pack       BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pack_items    TEXT[]        NOT NULL DEFAULT '{}';

-- Copy current prix_ht as the per-person unit price
UPDATE public.formation_templates SET prix_unitaire = prix_ht;

-- Track which catalogue template was used when creating a session
ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS template_code TEXT REFERENCES public.formation_templates(code) ON DELETE SET NULL;

-- Add TFP formation type
INSERT INTO public.formation_templates (code, label, description, prix_ht, prix_unitaire, duration_hours)
VALUES (
  'TFP',
  'TFP — Titre à Finalité Professionnelle',
  'Titre professionnel délivré par le ministère du Travail, reconnu au RNCP. Valide les compétences métier des agents de sécurité privée.',
  350, 350, 0
) ON CONFLICT (code) DO NOTHING;

-- Default packs
INSERT INTO public.formation_templates (code, label, description, prix_ht, prix_unitaire, duration_hours, is_pack, pack_items)
VALUES
  ('PACK_SST_TFP',
   'Pack SST + TFP',
   'Formation combinée Sauveteur Secouriste du Travail et Titre à Finalité Professionnelle — tarif préférentiel.',
   500, 500, 14, true, ARRAY['SST','TFP']),
  ('PACK_TFP_SSIAP1',
   'Pack TFP + SSIAP 1',
   'Formation combinée TFP et Agent de Sécurité Incendie SSIAP 1.',
   1000, 1000, 70, true, ARRAY['TFP','SSIAP1']),
  ('PACK_SST_TFP_SSIAP1',
   'Pack SST + TFP + SSIAP 1',
   'Formation complète combinant SST, Titre Professionnel et habilitation SSIAP 1.',
   1200, 1200, 84, true, ARRAY['SST','TFP','SSIAP1'])
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.formation_templates (
  code          TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  prix_ht       NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_hours NUMERIC(5,1) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.formation_templates (code, label, description, prix_ht, duration_hours) VALUES
  ('APS',     'APS — Agent de Prévention et de Sûreté',              'Formation aux techniques de base de la surveillance humaine et à la prévention des risques. Obligatoire pour exercer la profession d''agent de sécurité privée.',                               450,  140),
  ('SST',     'SST — Sauveteur Secouriste du Travail',                'Formation aux gestes de premiers secours en milieu professionnel. Permet d''intervenir efficacement face à une situation d''accident du travail.',                                                 200,   14),
  ('SSIAP1',  'SSIAP 1 — Agent de Sécurité Incendie',                'Formation initiale pour agent de service de sécurité incendie et d''assistance à personnes dans les établissements recevant du public.',                                                          800,   70),
  ('SSIAP2',  'SSIAP 2 — Chef d''équipe Sécurité Incendie',          'Formation chef d''équipe SSIAP, responsable de la coordination des agents SSIAP 1 et de la liaison avec les secours extérieurs.',                                                                1200,   55),
  ('SSIAP3',  'SSIAP 3 — Chef de service Sécurité Incendie',         'Formation chef de service SSIAP, responsable de l''organisation et de la gestion du service de sécurité incendie de l''établissement.',                                                           2500,  190),
  ('EPI',     'EPI / Extincteurs — Équipier de Première Intervention','Formation pratique à l''utilisation des extincteurs et à la gestion d''un début d''incendie. Destinée aux salariés désignés équipiers de première intervention.',                                  120,    7),
  ('MAC_APS', 'MAC APS — Maintien et Actualisation des Compétences', 'Recyclage périodique obligatoire pour maintenir la carte professionnelle APS. Actualisation des connaissances réglementaires et techniques.',                                                       150,   35),
  ('H0B0',   'H0B0 — Habilitation Électrique',                       'Habilitation non-électricien pour travailler dans un environnement comportant des risques électriques, sans réaliser d''opérations sur les installations.',                                          100,    7),
  ('AUTRE',   'Autre formation',                                      '',                                                                                                                                                                                                      0,    0)
;

ALTER TABLE public.formation_templates ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les rôles authentifiés
CREATE POLICY "auth_read_templates" ON public.formation_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Écriture réservée aux administrateurs
CREATE POLICY "admin_write_templates" ON public.formation_templates
  FOR ALL USING (public.has_role(auth.uid(), 'administrateur'));

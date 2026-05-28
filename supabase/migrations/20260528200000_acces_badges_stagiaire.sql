-- Ajout colonne stagiaire_id pour usage depuis l'espace stagiaire
ALTER TABLE public.registre_visiteurs ADD COLUMN IF NOT EXISTS stagiaire_id UUID REFERENCES public.stagiaires(id) ON DELETE SET NULL;
ALTER TABLE public.inventaire_cles    ADD COLUMN IF NOT EXISTS stagiaire_id UUID REFERENCES public.stagiaires(id) ON DELETE SET NULL;
ALTER TABLE public.inventaire_badges  ADD COLUMN IF NOT EXISTS stagiaire_id UUID REFERENCES public.stagiaires(id) ON DELETE SET NULL;

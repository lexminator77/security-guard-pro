ALTER TABLE public.formateurs
  ADD COLUMN IF NOT EXISTS cours_autorises TEXT[] NOT NULL DEFAULT '{}';

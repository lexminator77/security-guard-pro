DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entreprise_stagiaires' AND policyname = 'es_select_rh'
  ) THEN
    CREATE POLICY es_select_rh ON public.entreprise_stagiaires
      FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(), 'rh')
        AND entreprise_id = public.get_rh_entreprise_id()
      );
  END IF;
END $$;

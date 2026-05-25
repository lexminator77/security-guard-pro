
-- Enum rôles
CREATE TYPE public.app_role AS ENUM ('administrateur', 'formateur', 'agent', 'secretaire');
CREATE TYPE public.formation_type AS ENUM ('APS', 'SST', 'SSIAP1', 'SSIAP2', 'SSIAP3', 'MAC_APS', 'H0B0', 'AUTRE');
CREATE TYPE public.incident_severity AS ENUM ('faible', 'moyen', 'eleve', 'critique');
CREATE TYPE public.incident_status AS ENUM ('ouvert', 'en_cours', 'resolu');
CREATE TYPE public.stagiaire_status AS ENUM ('en_attente', 'valide', 'rejete', 'archive');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrateur'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrateur')) WITH CHECK (public.has_role(auth.uid(), 'administrateur'));

-- stagiaires
CREATE TABLE public.stagiaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  photo_url TEXT,
  carte_pro_number TEXT,
  carte_pro_expiry DATE,
  status public.stagiaire_status NOT NULL DEFAULT 'en_attente',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stagiaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stagiaires_select_auth" ON public.stagiaires FOR SELECT TO authenticated USING (true);
CREATE POLICY "stagiaires_admin_write" ON public.stagiaires FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'));

-- formations
CREATE TABLE public.formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type public.formation_type NOT NULL DEFAULT 'AUTRE',
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT,
  formateur_id UUID REFERENCES auth.users(id),
  max_participants INTEGER DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'planifiee',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formations_select_auth" ON public.formations FOR SELECT TO authenticated USING (true);
CREATE POLICY "formations_admin_write" ON public.formations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'formateur'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'formateur'));

-- incidents
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity public.incident_severity NOT NULL DEFAULT 'moyen',
  status public.incident_status NOT NULL DEFAULT 'ouvert',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_select_auth" ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "incidents_insert_auth" ON public.incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "incidents_update_owner_admin" ON public.incidents FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'administrateur'));
CREATE POLICY "incidents_delete_admin" ON public.incidents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stagiaires_updated BEFORE UPDATE ON public.stagiaires FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_formations_updated BEFORE UPDATE ON public.formations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_incidents_updated BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- handle new user: create profile + first user is admin, others secretaire
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INTEGER;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    assigned_role := 'administrateur';
  ELSE
    assigned_role := 'secretaire';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
  meta_role TEXT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  meta_role := NEW.raw_user_meta_data->>'role';

  IF meta_role IS NOT NULL AND meta_role IN ('administrateur','formateur','agent','secretaire') THEN
    assigned_role := meta_role::public.app_role;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  ELSE
    SELECT COUNT(*) INTO user_count FROM public.user_roles;
    IF user_count = 0 THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'administrateur');
    END IF;
  END IF;

  RETURN NEW;
END $function$;
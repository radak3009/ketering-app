-- Fix handle_new_user: ON CONFLICT je još koristio dropovanu kolonu user_roles.role.
-- Prelazimo na unique kombinaciju (user_id, role_id). Ako takav constraint ne postoji,
-- koristimo WHERE NOT EXISTS umesto ON CONFLICT (sigurno za jednog korisnika u tranzakciji).
--
-- ROLLBACK (vrati prethodnu verziju):
-- CREATE OR REPLACE FUNCTION public.handle_new_user() ... ON CONFLICT (user_id, role) DO NOTHING; ...

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_zaposleni_id uuid;
BEGIN
  SELECT id INTO v_zaposleni_id FROM public.roles WHERE key = 'zaposleni';
  IF v_zaposleni_id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: role "zaposleni" not found in public.roles';
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, email, tag, company_card_id, date_of_birth
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'tag',
    NULLIF(new.raw_user_meta_data ->> 'company_card_id', ''),
    NULLIF(new.raw_user_meta_data ->> 'date_of_birth', '')::date
  );

  INSERT INTO public.user_roles (user_id, role_id)
  SELECT new.id, v_zaposleni_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = new.id AND role_id = v_zaposleni_id
  );

  RETURN new;
END;
$function$;
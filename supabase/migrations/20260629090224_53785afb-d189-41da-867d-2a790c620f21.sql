
-- =====================================================================
-- M7.0: Non-destruktivno prevezivanje na granularne dozvole
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Sanity check: uloga 'zaposleni' mora postojati pre nego pipemo trigger
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE key = 'zaposleni') THEN
    RAISE EXCEPTION 'M7.0 abort: role "zaposleni" not found in public.roles';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1) Nove dozvole u katalogu
-- ---------------------------------------------------------------------
INSERT INTO public.permissions (key, group_key, label, description, sort_order)
VALUES
  ('receipts.view_all', 'reports', 'Pregled tuđih računa',
    'Skidanje fiskalnih računa drugih korisnika preko receipt-download edge funkcije.', 100),
  ('orders.fiscalize',  'orders',  'Fiskalizacija porudžbine',
    'Pokretanje fiskalizacije iz admin panela (korisnička grana fiscalize-meal).', 100)
ON CONFLICT (key) DO NOTHING;

-- Dodeli novim dozvolama allowed=false svim ulogama, pa Administrator allowed=true
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key, false
FROM public.roles r
CROSS JOIN (VALUES ('receipts.view_all'), ('orders.fiscalize')) AS p(key)
ON CONFLICT (role_id, permission_key) DO NOTHING;

UPDATE public.role_permissions rp
SET allowed = true
FROM public.roles r
WHERE rp.role_id = r.id
  AND r.key = 'administrator'
  AND rp.permission_key IN ('receipts.view_all', 'orders.fiscalize');

-- ---------------------------------------------------------------------
-- 2) RLS: public.profiles INSERT
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3) RLS: public.user_roles SELECT
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Roles viewers can view all user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_perm('users.view'));

-- ---------------------------------------------------------------------
-- 4) RLS: storage.objects — Resursi bucket
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view Resursi" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload Resursi" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update Resursi" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete Resursi" ON storage.objects;

CREATE POLICY "Resursi: view (settings.organization)"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'Resursi' AND public.has_perm('settings.organization'));

CREATE POLICY "Resursi: upload (settings.organization)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'Resursi' AND public.has_perm('settings.organization'));

CREATE POLICY "Resursi: update (settings.organization)"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'Resursi' AND public.has_perm('settings.organization'))
WITH CHECK (bucket_id = 'Resursi' AND public.has_perm('settings.organization'));

CREATE POLICY "Resursi: delete (settings.organization)"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'Resursi' AND public.has_perm('settings.organization'));

-- ---------------------------------------------------------------------
-- 5) RLS: storage.objects — Slike obroka bucket
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all meal images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload meal images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update meal images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete meal images" ON storage.objects;

-- SELECT: dostupno SVIM prijavljenim korisnicima (zaposleni vidi slike obroka)
CREATE POLICY "Slike obroka: view (any authenticated)"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'Slike obroka');

CREATE POLICY "Slike obroka: upload (meals.write)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'Slike obroka' AND public.has_perm('meals.write'));

CREATE POLICY "Slike obroka: update (meals.write)"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'Slike obroka' AND public.has_perm('meals.write'))
WITH CHECK (bucket_id = 'Slike obroka' AND public.has_perm('meals.write'));

CREATE POLICY "Slike obroka: delete (meals.delete)"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'Slike obroka' AND public.has_perm('meals.delete'));

-- ---------------------------------------------------------------------
-- 6) handle_new_user: ne piše profiles.role; upisuje user_roles(role_id zaposleni)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_zaposleni_id uuid;
BEGIN
  SELECT id INTO v_zaposleni_id FROM public.roles WHERE key = 'zaposleni';
  IF v_zaposleni_id IS NULL THEN
    RAISE EXCEPTION 'handle_new_user: role "zaposleni" not found in public.roles';
  END IF;

  -- 1) Profile: BEZ pisanja role kolone (default 'employee' iz definicije kolone ostaje).
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

  -- 2) user_roles: ubaci default "zaposleni" red (trigger sync_user_role_enum će popuniti `role`).
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (new.id, v_zaposleni_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$function$;

-- ---------------------------------------------------------------------
-- 7) Završni verifikacioni asserti (fail-closed)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_total int;
  v_admin int;
BEGIN
  SELECT count(*) INTO v_total FROM public.permissions;
  SELECT count(*) INTO v_admin
  FROM public.role_permissions rp
  JOIN public.roles r ON r.id = rp.role_id
  WHERE r.key = 'administrator' AND rp.allowed = true;

  IF v_admin <> v_total THEN
    RAISE EXCEPTION 'M7.0 verify failed: Administrator allowed=% of % permissions', v_admin, v_total;
  END IF;
END $$;

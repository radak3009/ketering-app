
-- M7.3 retry: prepravi policy koja referencira role, pa drop kolone.

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND NOT (company_id IS DISTINCT FROM (
    SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ))
  AND NOT (tag IS DISTINCT FROM (
    SELECT p.tag FROM public.profiles p WHERE p.user_id = auth.uid()
  ))
);

-- Backup u log
DO $$
DECLARE r RECORD; BEGIN
  RAISE LOG 'M7.3 backup user_roles:';
  FOR r IN SELECT user_id, role::text AS role, role_id FROM public.user_roles LOOP
    RAISE LOG '  ur user_id=% role=% role_id=%', r.user_id, r.role, r.role_id;
  END LOOP;
  RAISE LOG 'M7.3 backup profiles:';
  FOR r IN SELECT user_id, role::text AS role FROM public.profiles LOOP
    RAISE LOG '  pr user_id=% role=%', r.user_id, r.role;
  END LOOP;
END $$;

ALTER TABLE public.user_roles DROP COLUMN role;
ALTER TABLE public.profiles  DROP COLUMN role;

-- ROLLBACK:
-- ALTER TABLE public.profiles  ADD COLUMN role public.app_role NOT NULL DEFAULT 'employee';
-- ALTER TABLE public.user_roles ADD COLUMN role public.app_role;
-- UPDATE public.user_roles ur SET role = CASE WHEN r.panel='admin' THEN 'admin'::public.app_role ELSE 'employee'::public.app_role END
--   FROM public.roles r WHERE r.id = ur.role_id;
-- DROP POLICY "Users can update their own profile" ON public.profiles;
-- CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
--   USING (auth.uid()=user_id)
--   WITH CHECK (auth.uid()=user_id
--     AND NOT (role IS DISTINCT FROM (SELECT p.role FROM profiles p WHERE p.user_id=auth.uid()))
--     AND NOT (company_id IS DISTINCT FROM (SELECT p.company_id FROM profiles p WHERE p.user_id=auth.uid()))
--     AND NOT (tag IS DISTINCT FROM (SELECT p.tag FROM profiles p WHERE p.user_id=auth.uid())));

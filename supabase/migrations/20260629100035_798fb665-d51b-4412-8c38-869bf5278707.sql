
-- M7.2: Rewrite realtime.messages policies to use granular has_perm,
-- then drop legacy is_admin_user(uuid) and has_role(uuid, app_role).

-- 1) Realtime policies: zameni is_admin_user(auth.uid()) sa has_perm(...)
DROP POLICY IF EXISTS "Admins can subscribe to all realtime channels" ON realtime.messages;
CREATE POLICY "Admins can subscribe to all realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_perm('dashboard.view'));

DROP POLICY IF EXISTS "Admins can subscribe to kiosk channels" ON realtime.messages;
CREATE POLICY "Admins can subscribe to kiosk channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING ((realtime.topic() LIKE 'kiosk-%') AND public.has_perm('orders.view'));

DROP POLICY IF EXISTS "Admins only can subscribe to pickup_requests realtime" ON realtime.messages;
CREATE POLICY "Admins only can subscribe to pickup_requests realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING ((realtime.topic() LIKE '%pickup_requests%') AND public.has_perm('orders.view'));

-- 2) Drop legacy bridge funkcije
DROP FUNCTION IF EXISTS public.is_admin_user(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- ROLLBACK:
-- CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
--   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
--   SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
-- $$;
-- CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid uuid)
--   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
--   SELECT public.has_role(user_uuid, 'admin'::public.app_role)
-- $$;
-- DROP POLICY ... CREATE POLICY ... ON realtime.messages USING (is_admin_user(auth.uid())) ...

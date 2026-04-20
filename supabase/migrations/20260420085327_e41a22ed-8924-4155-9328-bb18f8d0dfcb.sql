-- 1. Restrict pickup_requests SELECT to authenticated role only
DROP POLICY IF EXISTS "Admins can view all pickup_requests" ON public.pickup_requests;
DROP POLICY IF EXISTS "Users can view own pickup requests" ON public.pickup_requests;

CREATE POLICY "Admins can view all pickup_requests"
ON public.pickup_requests
FOR SELECT
TO authenticated
USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view own pickup requests"
ON public.pickup_requests
FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- 2. Add admin-scoped policies for the private 'Resursi' bucket
DROP POLICY IF EXISTS "Admins can view Resursi" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload Resursi" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update Resursi" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete Resursi" ON storage.objects;

CREATE POLICY "Admins can view Resursi"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'Resursi' AND is_admin_user(auth.uid()));

CREATE POLICY "Admins can upload Resursi"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Resursi' AND is_admin_user(auth.uid()));

CREATE POLICY "Admins can update Resursi"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'Resursi' AND is_admin_user(auth.uid()))
WITH CHECK (bucket_id = 'Resursi' AND is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete Resursi"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'Resursi' AND is_admin_user(auth.uid()));
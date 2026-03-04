CREATE POLICY "Admins can insert pickup_requests"
ON public.pickup_requests
FOR INSERT
TO authenticated
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can update pickup_requests"
ON public.pickup_requests
FOR UPDATE
TO authenticated
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));
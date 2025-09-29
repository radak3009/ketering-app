-- Add policy for admins to update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));
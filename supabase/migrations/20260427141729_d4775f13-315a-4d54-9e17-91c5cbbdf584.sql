-- Strengthen INSERT policy on profiles to prevent privilege escalation
-- via the deprecated profiles.role column.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'employee'::app_role
);
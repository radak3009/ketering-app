-- Add RLS policy to allow admins to delete profiles
CREATE POLICY "Admins can delete all profiles" 
ON public.profiles
FOR DELETE 
USING (is_admin_user(auth.uid()));
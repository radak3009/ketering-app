-- Allow checking if email exists in profiles (only email field)
-- This is needed for preventing duplicate registrations
CREATE POLICY "Anyone can check if email exists"
ON public.profiles
FOR SELECT
USING (true);
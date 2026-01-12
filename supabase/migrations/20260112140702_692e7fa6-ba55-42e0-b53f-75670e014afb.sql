-- Add password_set column to profiles table
-- This tracks whether invited users have set their password
ALTER TABLE public.profiles 
ADD COLUMN password_set boolean NOT NULL DEFAULT false;

-- Update existing users to have password_set = true
-- (existing users either registered with password or are admins)
UPDATE public.profiles 
SET password_set = true 
WHERE user_id IS NOT NULL;
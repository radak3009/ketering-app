-- Add date_of_birth column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN date_of_birth date NULL;

COMMENT ON COLUMN public.profiles.date_of_birth IS 'User date of birth';
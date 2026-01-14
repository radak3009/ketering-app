-- Add tag column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tag text NULL;
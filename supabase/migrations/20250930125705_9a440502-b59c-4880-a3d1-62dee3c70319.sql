-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Anyone can check if email exists" ON public.profiles;

-- Create a function to check if email exists (more secure approach)
CREATE OR REPLACE FUNCTION public.email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE email = check_email
  );
$$;

-- Grant execute permission to all users (including anonymous)
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;
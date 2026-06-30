
-- Fix infinite recursion in profiles UPDATE policy by using SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.get_self_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_self_tag()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tag FROM public.profiles WHERE user_id = auth.uid()
$$;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND NOT (company_id IS DISTINCT FROM (SELECT public.get_self_company_id()))
  AND NOT (tag IS DISTINCT FROM (SELECT public.get_self_tag()))
);

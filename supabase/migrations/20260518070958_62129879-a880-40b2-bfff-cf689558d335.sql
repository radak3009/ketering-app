-- Remove employee SELECT access on meals table (employees use meals_secure view instead)
DROP POLICY IF EXISTS "Users can view active available meals" ON public.meals;
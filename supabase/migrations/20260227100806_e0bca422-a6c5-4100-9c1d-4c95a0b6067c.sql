-- Persisted meal groups catalog for admin meal management
CREATE TABLE IF NOT EXISTS public.meal_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_groups ENABLE ROW LEVEL SECURITY;

-- Ensure update timestamp automation
DROP TRIGGER IF EXISTS update_meal_groups_updated_at ON public.meal_groups;
CREATE TRIGGER update_meal_groups_updated_at
BEFORE UPDATE ON public.meal_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: admins manage, authenticated users can read
DROP POLICY IF EXISTS "Admins can manage meal groups" ON public.meal_groups;
CREATE POLICY "Admins can manage meal groups"
ON public.meal_groups
FOR ALL
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view meal groups" ON public.meal_groups;
CREATE POLICY "Authenticated users can view meal groups"
ON public.meal_groups
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Backfill existing groups from meals
INSERT INTO public.meal_groups (name)
SELECT DISTINCT btrim(meal_group) AS name
FROM public.meals
WHERE meal_group IS NOT NULL
  AND btrim(meal_group) <> ''
ON CONFLICT (name) DO NOTHING;
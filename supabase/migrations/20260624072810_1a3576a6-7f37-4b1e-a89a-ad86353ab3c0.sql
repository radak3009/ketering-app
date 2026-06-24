CREATE TABLE IF NOT EXISTS public.allergens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.allergens TO authenticated;
GRANT ALL ON public.allergens TO service_role;

ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allergens readable by authenticated"
  ON public.allergens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert allergens"
  ON public.allergens FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete allergens"
  ON public.allergens FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

INSERT INTO public.allergens (name)
SELECT DISTINCT trim(a)
FROM public.meals, unnest(allergens) AS a
WHERE allergens IS NOT NULL AND trim(a) <> ''
ON CONFLICT (name) DO NOTHING;
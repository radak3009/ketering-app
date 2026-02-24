
-- 1. Dodati allowed_tags kolonu
ALTER TABLE public.meals ADD COLUMN allowed_tags TEXT[] DEFAULT NULL;

-- 2. Ažurirati meals_secure view sa filtriranjem po tagu
CREATE OR REPLACE VIEW public.meals_secure AS
SELECT id, name, description, price,
  CASE WHEN is_admin_user(auth.uid()) THEN purchase_price ELSE NULL END AS purchase_price,
  category, code, status, shifts, allergens, image_url, is_available,
  nutritional_info, created_at, updated_at, allowed_tags
FROM public.meals
WHERE (
  allowed_tags IS NULL
  OR array_length(allowed_tags, 1) IS NULL
  OR allowed_tags && ARRAY(
    SELECT tag FROM public.profiles WHERE user_id = auth.uid() AND tag IS NOT NULL
  )
);

-- 3. Ažurirati RLS politiku za employee korisnike
DROP POLICY IF EXISTS "Users can view active available meals" ON public.meals;
CREATE POLICY "Users can view active available meals" ON public.meals
  FOR SELECT USING (
    is_available = true
    AND status = 'aktivan'
    AND (
      allowed_tags IS NULL
      OR array_length(allowed_tags, 1) IS NULL
      OR allowed_tags && ARRAY(
        SELECT tag FROM public.profiles WHERE user_id = auth.uid() AND tag IS NOT NULL
      )
    )
  );

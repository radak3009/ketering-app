
-- Fix: Use security_invoker instead of security_definer for meals_secure view
CREATE OR REPLACE VIEW public.meals_secure
WITH (security_invoker=on) AS
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

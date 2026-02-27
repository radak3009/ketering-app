-- Recreate meals_secure view as SECURITY INVOKER instead of SECURITY DEFINER
DROP VIEW IF EXISTS public.meals_secure;

CREATE VIEW public.meals_secure
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  description,
  price,
  CASE
    WHEN is_admin_user(auth.uid()) THEN purchase_price
    ELSE NULL::numeric
  END AS purchase_price,
  category,
  code,
  status,
  shifts,
  allergens,
  image_url,
  is_available,
  nutritional_info,
  created_at,
  updated_at,
  allowed_tags,
  meal_group
FROM meals
WHERE
  allowed_tags IS NULL
  OR array_length(allowed_tags, 1) IS NULL
  OR allowed_tags && ARRAY(
    SELECT profiles.tag
    FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.tag IS NOT NULL
  );
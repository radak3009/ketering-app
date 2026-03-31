
DROP VIEW IF EXISTS public.meals_secure;

CREATE VIEW public.meals_secure
WITH (security_invoker = true) AS
SELECT
  id, name, description, image_url, category,
  price, code, is_available, allergens, status,
  shifts, allowed_tags, meal_group, nutritional_info,
  created_at, updated_at
FROM public.meals;

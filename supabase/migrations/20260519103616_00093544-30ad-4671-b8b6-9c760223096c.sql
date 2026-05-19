-- Restore employee read access to meals (needed for embedded joins from order_items and menu_meals)
-- Hide purchase_price via column privileges instead of dropping RLS access entirely.

CREATE POLICY "Users can view active available meals"
ON public.meals
FOR SELECT
TO authenticated
USING (status = 'aktivan' AND is_available = true);

-- Restrict column-level access: revoke broad SELECT, then grant SELECT on all non-sensitive columns
REVOKE SELECT ON public.meals FROM authenticated;
GRANT SELECT (
  id, name, description, category, image_url, allergens, nutritional_info,
  is_available, status, shifts, allowed_tags, meal_group, code, price,
  created_at, updated_at
) ON public.meals TO authenticated;

-- Admins keep full access (including purchase_price) via service role and the existing admin policies;
-- grant purchase_price explicitly to service_role to be safe
GRANT SELECT ON public.meals TO service_role;
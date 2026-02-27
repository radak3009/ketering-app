-- Add meal_group column to meals table
ALTER TABLE public.meals ADD COLUMN meal_group text;

-- Recreate meals_secure view to include meal_group
CREATE OR REPLACE VIEW public.meals_secure AS
SELECT id,
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
WHERE ((allowed_tags IS NULL) OR (array_length(allowed_tags, 1) IS NULL) OR (allowed_tags && ARRAY(
    SELECT profiles.tag
    FROM profiles
    WHERE ((profiles.user_id = auth.uid()) AND (profiles.tag IS NOT NULL))
)));
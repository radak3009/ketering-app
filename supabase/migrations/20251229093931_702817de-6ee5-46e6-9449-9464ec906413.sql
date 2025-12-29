-- Drop existing view
DROP VIEW IF EXISTS public.meals_secure;

-- Recreate view with security_invoker = true
-- This ensures the view respects RLS policies of the calling user, not the view owner
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
    updated_at
FROM meals;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON public.meals_secure TO authenticated;
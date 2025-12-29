-- Drop existing view if it exists
DROP VIEW IF EXISTS public.meals_secure;

-- Create a secure view that hides purchase_price from non-admin users
CREATE VIEW public.meals_secure AS
SELECT 
  id,
  name,
  description,
  price,
  CASE 
    WHEN is_admin_user(auth.uid()) THEN purchase_price 
    ELSE NULL 
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
FROM public.meals;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.meals_secure TO authenticated;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.meals_secure IS 'Secure view of meals table that hides purchase_price from non-admin users';
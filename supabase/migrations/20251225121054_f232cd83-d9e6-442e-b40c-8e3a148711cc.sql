-- Create a secure view for meals that hides purchase_price from non-admin users
CREATE OR REPLACE VIEW public.meals_secure AS
SELECT 
  id,
  name,
  description,
  category,
  price,
  -- Only show purchase_price to admins
  CASE WHEN public.is_admin_user(auth.uid()) THEN purchase_price ELSE NULL END AS purchase_price,
  image_url,
  is_available,
  status,
  allergens,
  nutritional_info,
  shifts,
  code,
  created_at,
  updated_at
FROM public.meals;

-- Grant access to the view
GRANT SELECT ON public.meals_secure TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW public.meals_secure IS 'Secure view of meals table that hides purchase_price from non-admin users';
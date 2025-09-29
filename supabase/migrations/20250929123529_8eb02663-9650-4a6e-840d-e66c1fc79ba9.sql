-- Add new columns to meals table for shift availability and status
ALTER TABLE public.meals 
ADD COLUMN status text NOT NULL DEFAULT 'aktivan' CHECK (status IN ('aktivan', 'neaktivan')),
ADD COLUMN shifts text[] NOT NULL DEFAULT ARRAY['prva', 'druga', 'treća'];

-- Add index for better performance on status queries
CREATE INDEX idx_meals_status ON public.meals(status);

-- Update RLS policy for meals to only show active meals to employees
DROP POLICY IF EXISTS "Everyone can view available meals" ON public.meals;

CREATE POLICY "Users can view active available meals" 
ON public.meals 
FOR SELECT 
USING (is_available = true AND status = 'aktivan');

CREATE POLICY "Admins can view all meals" 
ON public.meals 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'::app_role
));
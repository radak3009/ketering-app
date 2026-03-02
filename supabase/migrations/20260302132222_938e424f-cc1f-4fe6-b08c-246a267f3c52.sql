
-- Drop existing employee insert policy
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

-- New policy: employees must have company_card_id to create orders
CREATE POLICY "Users can create their own orders" ON public.orders
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_card_id IS NOT NULL
    AND profiles.company_card_id <> ''
  )
);

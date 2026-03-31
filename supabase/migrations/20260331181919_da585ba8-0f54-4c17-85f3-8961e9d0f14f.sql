
-- Drop the permissive user update policy
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;

-- Recreate with restrictive WITH CHECK: users can only update notes on their own pending orders
-- total_amount, status, delivery_date, menu_id are protected from user manipulation
CREATE POLICY "Users can update their own orders"
ON orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IS NOT DISTINCT FROM (SELECT o.status FROM orders o WHERE o.id = id)
  AND total_amount IS NOT DISTINCT FROM (SELECT o.total_amount FROM orders o WHERE o.id = id)
  AND delivery_date IS NOT DISTINCT FROM (SELECT o.delivery_date FROM orders o WHERE o.id = id)
  AND menu_id IS NOT DISTINCT FROM (SELECT o.menu_id FROM orders o WHERE o.id = id)
);

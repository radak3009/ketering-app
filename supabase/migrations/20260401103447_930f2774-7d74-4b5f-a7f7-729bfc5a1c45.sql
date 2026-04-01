
DROP POLICY "Users can update their own orders" ON orders;

CREATE POLICY "Users can update their own orders"
ON orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  NOT (status IS DISTINCT FROM (SELECT o.status FROM orders o WHERE o.id = orders.id)) AND
  NOT (total_amount IS DISTINCT FROM (SELECT o.total_amount FROM orders o WHERE o.id = orders.id)) AND
  NOT (delivery_date IS DISTINCT FROM (SELECT o.delivery_date FROM orders o WHERE o.id = orders.id)) AND
  NOT (menu_id IS DISTINCT FROM (SELECT o.menu_id FROM orders o WHERE o.id = orders.id))
);

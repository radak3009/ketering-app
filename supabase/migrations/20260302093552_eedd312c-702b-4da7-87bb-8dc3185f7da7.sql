
-- Admin INSERT policy for orders (create orders for any user)
CREATE POLICY "Admins can insert orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (is_admin_user(auth.uid()));

-- Admin DELETE policy for orders
CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (is_admin_user(auth.uid()));

-- Admin INSERT policy for order_items
CREATE POLICY "Admins can insert order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (is_admin_user(auth.uid()));

-- Admin UPDATE policy for order_items
CREATE POLICY "Admins can update order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Admin DELETE policy for order_items
CREATE POLICY "Admins can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (is_admin_user(auth.uid()));

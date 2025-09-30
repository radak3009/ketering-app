-- Add DELETE policy for order_items so users can delete their own order items
CREATE POLICY "Users can delete their own order items"
ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  )
);
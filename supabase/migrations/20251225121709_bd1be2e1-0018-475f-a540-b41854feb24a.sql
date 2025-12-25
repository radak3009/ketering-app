-- Enable realtime for order_items table
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- Set REPLICA IDENTITY FULL for complete row data in realtime updates
ALTER TABLE order_items REPLICA IDENTITY FULL;

-- Create function to cleanup empty orders when last order_item is deleted
CREATE OR REPLACE FUNCTION public.cleanup_empty_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the order if it has no more items
  DELETE FROM public.orders 
  WHERE id = OLD.order_id 
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = OLD.order_id
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-cleanup empty orders
CREATE TRIGGER trigger_cleanup_empty_orders
AFTER DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_empty_orders();
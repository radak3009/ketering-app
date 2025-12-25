-- Enable realtime for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Set REPLICA IDENTITY FULL for complete row data
ALTER TABLE orders REPLICA IDENTITY FULL;
-- Enable realtime for pickup_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE pickup_requests;

-- Set REPLICA IDENTITY FULL for complete row data in realtime updates
ALTER TABLE pickup_requests REPLICA IDENTITY FULL;
-- Drop the insecure INSERT policy
DROP POLICY IF EXISTS "Service role can upload receipts" ON storage.objects;

-- Recreate, restricted to service_role only
CREATE POLICY "Service role can upload receipts"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'receipts');
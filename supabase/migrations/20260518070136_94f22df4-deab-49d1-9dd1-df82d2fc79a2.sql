UPDATE public.pickup_requests p
SET receipt_file_path = NULL
WHERE p.receipt_file_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'receipts' AND o.name = p.receipt_file_path
  );
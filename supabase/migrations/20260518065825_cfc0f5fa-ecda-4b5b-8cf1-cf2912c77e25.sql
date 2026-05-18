CREATE OR REPLACE FUNCTION public.list_old_receipts(cutoff timestamptz, max_rows int DEFAULT 500)
RETURNS TABLE(name text, size bigint, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name, COALESCE((o.metadata->>'size')::bigint, 0) AS size, o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'receipts'
    AND o.created_at < cutoff
  ORDER BY o.created_at ASC
  LIMIT max_rows;
$$;

REVOKE ALL ON FUNCTION public.list_old_receipts(timestamptz, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_old_receipts(timestamptz, int) TO service_role;
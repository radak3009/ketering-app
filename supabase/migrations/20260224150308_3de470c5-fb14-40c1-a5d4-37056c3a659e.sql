
ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS fiscal_retry_count INTEGER NOT NULL DEFAULT 0;

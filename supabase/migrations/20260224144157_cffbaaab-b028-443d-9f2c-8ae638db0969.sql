
-- Add fiscal columns to pickup_requests
ALTER TABLE pickup_requests
  ADD COLUMN IF NOT EXISTS fiscal_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fiscal_external_id TEXT,
  ADD COLUMN IF NOT EXISTS octopos_weborder_id INTEGER,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS verification_url TEXT,
  ADD COLUMN IF NOT EXISTS receipt_text_top TEXT,
  ADD COLUMN IF NOT EXISTS receipt_text_bottom TEXT,
  ADD COLUMN IF NOT EXISTS receipt_file_path TEXT,
  ADD COLUMN IF NOT EXISTS fiscalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fiscal_error TEXT;

-- Idempotency constraint
ALTER TABLE pickup_requests
  ADD CONSTRAINT unique_fiscal_external_id UNIQUE (fiscal_external_id);

-- Create receipts storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can read own receipts (folder = user_id from profiles)
CREATE POLICY "Users can read own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT p.user_id::text FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Allow service role uploads (no user restriction for INSERT)
CREATE POLICY "Service role can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

-- RLS: employees can view their own pickup_requests via profile_id -> profiles.user_id
CREATE POLICY "Users can view own pickup requests"
  ON pickup_requests FOR SELECT
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

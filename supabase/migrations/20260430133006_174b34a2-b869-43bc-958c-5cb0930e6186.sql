CREATE TABLE public.email_verification_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all verification tokens"
  ON public.email_verification_tokens
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- Enable RLS on realtime.messages (Supabase manages the table; we only add policies)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Admins can subscribe to all realtime channels" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can subscribe to kiosk channels" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can read broadcast channel" ON realtime.messages;

-- Admins: full access to all realtime channels
CREATE POLICY "Admins can subscribe to all realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- Kiosk channels: open to authenticated users (kiosk devices share auth)
-- The kiosk channel name used in the app is 'kiosk-kitchen-realtime'
CREATE POLICY "Authenticated users can subscribe to kiosk channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'kiosk-%'
);

-- Broadcasts channel: open to all authenticated users (admin → employee notifications)
CREATE POLICY "Authenticated users can read broadcast channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'admin-broadcasts'
  OR realtime.topic() LIKE 'broadcast-%'
);
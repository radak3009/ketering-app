-- Tighten Realtime kiosk channel policy: only admins may subscribe to kiosk-% topics
-- This prevents regular authenticated employees from eavesdropping on fiscal data
-- in pickup_requests broadcast over Realtime postgres_changes.

DROP POLICY IF EXISTS "Authenticated users can subscribe to kiosk channels" ON realtime.messages;

CREATE POLICY "Admins can subscribe to kiosk channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'kiosk-%'
  AND public.is_admin_user(auth.uid())
);
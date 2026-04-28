-- Restrict Realtime postgres_changes for pickup_requests to admins only.
-- Realtime postgres_changes uses topic 'realtime:public:pickup_requests' (and variants
-- with filters). We add a SELECT policy on realtime.messages that only allows admins
-- to receive messages on any topic referencing pickup_requests.

-- Drop any prior version of this policy to keep migration idempotent
DROP POLICY IF EXISTS "Admins only can subscribe to pickup_requests realtime"
  ON realtime.messages;

CREATE POLICY "Admins only can subscribe to pickup_requests realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Only applies to topics that target the pickup_requests table
  (
    realtime.topic() LIKE '%pickup_requests%'
  )
  AND public.is_admin_user(auth.uid())
);
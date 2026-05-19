-- Drop the overly permissive broadcast subscription policy
DROP POLICY IF EXISTS "Authenticated users can read broadcast channel" ON realtime.messages;

-- Recreate scoped to only the admin-broadcasts topic
CREATE POLICY "Authenticated users can read admin-broadcasts topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (realtime.topic() = 'admin-broadcasts');
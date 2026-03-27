
DROP POLICY "Admins can manage broadcasts" ON public.admin_broadcasts;

CREATE POLICY "Admins can read broadcasts" ON public.admin_broadcasts
  FOR SELECT TO authenticated USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert broadcasts" ON public.admin_broadcasts
  FOR INSERT TO authenticated WITH CHECK (is_admin_user(auth.uid()));

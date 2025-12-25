-- Dodaj RLS politiku za admina da može čitati sve uloge
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- Sinhronizuj user_roles sa profiles za korisnike koji nemaju zapis
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, p.role 
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
);
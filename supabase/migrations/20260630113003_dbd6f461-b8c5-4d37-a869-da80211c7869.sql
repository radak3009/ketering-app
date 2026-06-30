-- Backfill: assign default 'zaposleni' role to any user missing a role row
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, (SELECT id FROM public.roles WHERE key = 'zaposleni')
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
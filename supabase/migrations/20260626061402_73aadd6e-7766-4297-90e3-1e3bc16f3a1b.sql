
-- 1. Tables
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  panel text NOT NULL DEFAULT 'admin' CHECK (panel IN ('admin','employee')),
  is_system boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read roles" ON public.roles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  group_key text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_roles_updated BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_role_perm_updated BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add role_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- 3. Seed roles
INSERT INTO public.roles (key, name, description, panel, is_system, is_demo) VALUES
  ('administrator', 'Administrator', 'Pun pristup, uključujući upravljanje ulogama', 'admin', true, false),
  ('hr', 'HR', 'Upravljanje korisnicima, organizacijom i izveštajima', 'admin', true, false),
  ('kuhinja', 'Kuhinja', 'Pregled porudžbina i označavanje preuzimanja', 'admin', true, false),
  ('zaposleni', 'Zaposleni', 'Naručivanje obroka i lične akcije', 'employee', true, false),
  ('demo', 'Demo korisnik', 'Pregled svih sekcija; bez izmena i slanja', 'admin', true, true);

-- 4. Seed permissions catalog
INSERT INTO public.permissions (key, group_key, label, sort_order) VALUES
  ('dashboard.view','dashboard','Pregled KPI',10),
  ('orders.view','orders','Pregled porudžbina',10),
  ('orders.create','orders','Kreiranje porudžbina',20),
  ('orders.update','orders','Izmena porudžbina',30),
  ('orders.delete','orders','Brisanje porudžbina',40),
  ('orders.export_csv','orders','Izvoz CSV',50),
  ('orders.mark_pickup','orders','Označavanje preuzimanja',60),
  ('meals.view','meals','Pregled obroka',10),
  ('meals.write','meals','Kreiranje/izmena obroka',20),
  ('meals.delete','meals','Brisanje obroka',30),
  ('meals.upload_image','meals','Upload slika',40),
  ('menus.view','menus','Pregled jelovnika',10),
  ('menus.write','menus','Kreiranje/izmena jelovnika',20),
  ('menus.delete','menus','Brisanje jelovnika',30),
  ('menus.templates','menus','Šabloni',40),
  ('users.view','users','Pregled korisnika',10),
  ('users.create','users','Kreiranje korisnika',20),
  ('users.update','users','Izmena korisnika',30),
  ('users.delete','users','Brisanje korisnika',40),
  ('users.assign_role','users','Dodela uloga',50),
  ('users.invite','users','Slanje pozivnica',60),
  ('users.import','users','Uvoz korisnika',70),
  ('feedback.view','feedback','Pregled utisaka',10),
  ('feedback.process','feedback','Obrada utisaka',20),
  ('suggestions.view','feedback','Pregled predloga',30),
  ('suggestions.process','feedback','Obrada predloga',40),
  ('notifications.menu','notifications','Obaveštenje o jelovniku',10),
  ('notifications.reminder','notifications','Podsetnik zaposlenima',20),
  ('notifications.custom_email','notifications','Custom email obaveštenje',30),
  ('reports.view','reports','Pregled izveštaja',10),
  ('reports.export','reports','Izvoz izveštaja',20),
  ('settings.kiosk','settings','Postavke kioska',10),
  ('settings.kitchen','settings','Postavke kuhinje',20),
  ('settings.organization','settings','Organizacija (tagovi)',30),
  ('settings.roles','settings','Uloge i dozvole',40),
  ('self.order','self','Naručivanje',10),
  ('self.my_orders','self','Pregled svojih porudžbina',20),
  ('self.feedback','self','Slanje utisaka',30),
  ('self.suggestions','self','Slanje predloga',40),
  ('self.profile','self','Profil',50),
  ('self.nfc','self','NFC preuzimanje',60);

-- 5. Seed role_permissions
-- Administrator: all true
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key, true FROM public.roles r CROSS JOIN public.permissions p WHERE r.key='administrator';

-- HR
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key,
  CASE WHEN p.key IN (
    'dashboard.view',
    'users.view','users.create','users.update','users.delete','users.assign_role','users.invite','users.import',
    'settings.organization',
    'reports.view','reports.export',
    'notifications.custom_email',
    'feedback.view','suggestions.view'
  ) THEN true ELSE false END
FROM public.roles r CROSS JOIN public.permissions p WHERE r.key='hr';

-- Kuhinja
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key,
  CASE WHEN p.key IN (
    'dashboard.view',
    'orders.view','orders.mark_pickup','orders.export_csv',
    'meals.view','menus.view'
  ) THEN true ELSE false END
FROM public.roles r CROSS JOIN public.permissions p WHERE r.key='kuhinja';

-- Zaposleni
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key,
  CASE WHEN p.group_key='self' THEN true ELSE false END
FROM public.roles r CROSS JOIN public.permissions p WHERE r.key='zaposleni';

-- Demo: all *.view + dashboard.view + self.*
INSERT INTO public.role_permissions (role_id, permission_key, allowed)
SELECT r.id, p.key,
  CASE WHEN p.key LIKE '%.view' OR p.key='dashboard.view' OR p.group_key='self' THEN true ELSE false END
FROM public.roles r CROSS JOIN public.permissions p WHERE r.key='demo';

-- 6. Backfill user_roles.role_id
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE ur.role_id IS NULL
  AND ((ur.role = 'admin'::app_role AND r.key='administrator')
    OR (ur.role = 'employee'::app_role AND r.key='zaposleni'));

-- 7. Trigger to sync enum role from roles.panel when role_id is set
CREATE OR REPLACE FUNCTION public.sync_user_role_enum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel text;
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT panel INTO v_panel FROM public.roles WHERE id = NEW.role_id;
    IF v_panel = 'admin' THEN
      NEW.role := 'admin'::app_role;
    ELSIF v_panel = 'employee' THEN
      NEW.role := 'employee'::app_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_role_enum ON public.user_roles;
CREATE TRIGGER trg_sync_user_role_enum
BEFORE INSERT OR UPDATE OF role_id ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_enum();

-- 8. Helper functions
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT rp.permission_key
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  WHERE ur.user_id = _user AND rp.allowed = true;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = _user AND rp.permission_key = _perm AND rp.allowed = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_demo_user(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user AND r.is_demo = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_demo_user(uuid) TO authenticated;

-- 9. Returns current user's panel ('admin' or 'employee'), picking 'admin' if any role is admin-panel
CREATE OR REPLACE FUNCTION public.get_user_panel(_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _user AND r.panel = 'admin'
    ) THEN 'admin'
    ELSE 'employee'
  END;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_panel(uuid) TO authenticated;

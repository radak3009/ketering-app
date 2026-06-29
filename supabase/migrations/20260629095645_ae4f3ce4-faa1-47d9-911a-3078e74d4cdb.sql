
-- M7.1: Drop enum-bridge trigger and its sync function.
-- Backup (informativno): trenutni sadržaj user_roles pre M7.1.
DO $$
DECLARE r RECORD; BEGIN
  RAISE LOG 'M7.1 backup user_roles snapshot:';
  FOR r IN SELECT user_id, role::text AS role, role_id FROM public.user_roles LOOP
    RAISE LOG '  user_id=% role=% role_id=%', r.user_id, r.role, r.role_id;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_sync_user_role_enum ON public.user_roles;
DROP FUNCTION IF EXISTS public.sync_user_role_enum();

-- ROLLBACK:
-- CREATE OR REPLACE FUNCTION public.sync_user_role_enum() RETURNS trigger
--   LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $fn$
-- DECLARE v_panel text;
-- BEGIN
--   IF NEW.role_id IS NOT NULL THEN
--     SELECT panel INTO v_panel FROM public.roles WHERE id = NEW.role_id;
--     IF v_panel = 'admin' THEN NEW.role := 'admin'::app_role;
--     ELSIF v_panel = 'employee' THEN NEW.role := 'employee'::app_role;
--     END IF;
--   END IF;
--   RETURN NEW;
-- END; $fn$;
-- CREATE TRIGGER trg_sync_user_role_enum BEFORE INSERT OR UPDATE ON public.user_roles
--   FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_enum();

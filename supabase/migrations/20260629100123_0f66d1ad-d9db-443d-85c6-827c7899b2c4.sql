
-- M7.4: Drop legacy enum type.
DROP TYPE public.app_role;

-- ROLLBACK:
-- CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

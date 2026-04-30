-- 1. Cleanup zombie profiles: never signed in / never confirmed email AND no company_card_id
DO $$
DECLARE
  zombie_user_id uuid;
BEGIN
  FOR zombie_user_id IN
    SELECT p.user_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE (p.company_card_id IS NULL OR p.company_card_id = '')
      AND (u.last_sign_in_at IS NULL OR u.email_confirmed_at IS NULL)
  LOOP
    -- Delete profile first (FK-safe)
    DELETE FROM public.user_roles WHERE user_id = zombie_user_id;
    DELETE FROM public.profiles WHERE user_id = zombie_user_id;
    -- Delete auth user
    DELETE FROM auth.users WHERE id = zombie_user_id;
  END LOOP;
END $$;

-- 2. Case-insensitive unique email constraint
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

-- 3. Unique company_card_id (partial - allows NULL)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_company_card_id_unique
  ON public.profiles (company_card_id)
  WHERE company_card_id IS NOT NULL AND company_card_id <> '';

-- 4. Update email_exists to be case-insensitive
CREATE OR REPLACE FUNCTION public.email_exists(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(email) = lower(check_email)
  );
$$;

-- 5. New function: check if company_card_id is taken
CREATE OR REPLACE FUNCTION public.company_card_id_exists(check_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE company_card_id = check_id
  );
$$;

-- 6. Update handle_new_user trigger to populate company_card_id and date_of_birth from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, full_name, email, role, tag, company_card_id, date_of_birth
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    COALESCE((new.raw_user_meta_data ->> 'role')::app_role, 'employee'::app_role),
    new.raw_user_meta_data ->> 'tag',
    NULLIF(new.raw_user_meta_data ->> 'company_card_id', ''),
    NULLIF(new.raw_user_meta_data ->> 'date_of_birth', '')::date
  );
  RETURN new;
END;
$$;
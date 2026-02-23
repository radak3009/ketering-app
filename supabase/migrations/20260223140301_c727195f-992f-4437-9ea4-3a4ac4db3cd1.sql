
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role, tag)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    COALESCE((new.raw_user_meta_data ->> 'role')::app_role, 'employee'::app_role),
    new.raw_user_meta_data ->> 'tag'
  );
  RETURN new;
END;
$function$;

-- Create function to sync email from auth.users to profiles when email is confirmed
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When auth.users email is updated and confirmed, sync to profiles
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET email = NEW.email, updated_at = now()
    WHERE user_id = NEW.id;
    
    RAISE LOG 'Email synced from auth.users to profiles for user %: % -> %', NEW.id, OLD.email, NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to sync email changes
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();
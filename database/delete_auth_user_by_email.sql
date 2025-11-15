-- Function to delete an auth user by email
-- This function uses SECURITY DEFINER to run with elevated privileges
-- It can delete users from the auth schema when called by admins
-- 
-- IMPORTANT: This function must be run with proper permissions.
-- Supabase may restrict direct access to auth.users, so this may need
-- to be run as a service role or through an Edge Function.

CREATE OR REPLACE FUNCTION public.delete_auth_user_by_email(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_id_found UUID;
  deleted_count INTEGER;
  job_count INTEGER;
BEGIN
  -- Find the user ID by email
  SELECT id INTO user_id_found
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;

  -- Check if user exists
  IF user_id_found IS NULL THEN
    RAISE NOTICE 'User with email % does not exist in auth.users', user_email;
    RETURN false;
  END IF;

  -- First, delete or update any jobs that reference this user via foreign key
  -- Check if there are jobs with posted_by referencing this user
  SELECT COUNT(*) INTO job_count
  FROM public.jobs
  WHERE posted_by = user_id_found;
  
  IF job_count > 0 THEN
    RAISE NOTICE 'Found % jobs referencing this user. Deleting them first...', job_count;
    -- Delete applications for these jobs first
    DELETE FROM public.applications 
    WHERE job_id IN (SELECT id FROM public.jobs WHERE posted_by = user_id_found);
    -- Delete the jobs
    DELETE FROM public.jobs WHERE posted_by = user_id_found;
    RAISE NOTICE 'Deleted % jobs and their applications', job_count;
  END IF;

  -- Also check and delete from jobvacancypending if it has a posted_by column
  -- (Adjust column name if different)
  BEGIN
    DELETE FROM public.jobvacancypending WHERE posted_by = user_id_found;
  EXCEPTION
    WHEN undefined_column THEN
      -- Column doesn't exist, skip
      NULL;
    WHEN OTHERS THEN
      -- Other error, log but continue
      RAISE WARNING 'Could not delete from jobvacancypending: %', SQLERRM;
  END;

  -- Delete from auth.users
  -- Note: This requires the function to have proper permissions
  -- If this fails, you may need to use Supabase Admin API or Edge Function
  DELETE FROM auth.users WHERE id = user_id_found;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Successfully deleted auth user % (email: %)', user_id_found, user_email;
    RETURN true;
  ELSE
    RAISE WARNING 'Failed to delete auth user % (email: %) - no rows affected', user_id_found, user_email;
    RETURN false;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'Insufficient privileges to delete from auth.users. This function may need to be run with service role privileges or through a Supabase Edge Function. Error: %', SQLERRM;
  WHEN OTHERS THEN
    -- Log the error with more details
    RAISE WARNING 'Error deleting auth user with email %: % (SQLSTATE: %)', user_email, SQLERRM, SQLSTATE;
    -- Return the error message in a way that can be checked
    RAISE EXCEPTION 'Failed to delete auth user: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (admins will use this)
GRANT EXECUTE ON FUNCTION public.delete_auth_user_by_email(TEXT) TO authenticated;

-- Also grant to anon for public cleanup (optional, remove if you want admin-only)
-- GRANT EXECUTE ON FUNCTION public.delete_auth_user_by_email(TEXT) TO anon;


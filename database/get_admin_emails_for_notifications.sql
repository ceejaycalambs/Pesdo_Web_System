-- Create a function to get admin emails for job submission notifications
-- This function uses SECURITY DEFINER to bypass RLS, allowing employers to get admin emails
-- for notification purposes without exposing other admin profile data

CREATE OR REPLACE FUNCTION public.get_admin_emails_for_notifications()
RETURNS TABLE (
  email TEXT,
  first_name TEXT,
  last_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Return only regular admins (not super_admin) with their email and name
  -- This function bypasses RLS using SECURITY DEFINER
  RETURN QUERY
  SELECT 
    ap.email,
    ap.first_name,
    ap.last_name
  FROM public.admin_profiles ap
  WHERE ap.role = 'admin'
    AND ap.email IS NOT NULL
    AND ap.email != '';
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_admin_emails_for_notifications() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_admin_emails_for_notifications() IS 'Returns admin emails and names for notification purposes. Bypasses RLS to allow employers to notify admins about job submissions. Only returns regular admins (role = admin), not super_admins.';


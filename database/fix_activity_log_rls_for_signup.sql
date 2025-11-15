-- Fix RLS Policy for Activity Log to Allow Account Creation Logging
-- This allows newly created users to log their account creation activity

-- Drop the existing policy
DROP POLICY IF EXISTS "users_can_insert_own_activity_logs" ON public.activity_log;

-- Create a more permissive policy that allows:
-- 1. Users to insert their own activity logs (auth.uid() = user_id)
-- 2. Users to insert activity logs during signup (when they're creating their account)
-- 3. Account creation logs (action_type = 'account_created')
CREATE POLICY "users_can_insert_own_activity_logs" ON public.activity_log
    FOR INSERT
    WITH CHECK (
        -- Allow if the user_id matches the authenticated user
        auth.uid() = user_id
        OR
        -- Allow account creation logs (during signup, the user might not be fully authenticated yet)
        (action_type = 'account_created' AND auth.uid() = user_id)
        OR
        -- Allow if the user_id exists in any profile table (for account creation)
        (
            action_type = 'account_created' AND
            (
                EXISTS (SELECT 1 FROM public.jobseeker_profiles WHERE id = user_id)
                OR EXISTS (SELECT 1 FROM public.employer_profiles WHERE id = user_id)
                OR EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = user_id)
            )
        )
    );

-- Alternative: Create a function with SECURITY DEFINER to bypass RLS for activity logging
-- This is more secure and reliable
CREATE OR REPLACE FUNCTION public.insert_activity_log(
    p_user_id UUID,
    p_user_type TEXT,
    p_action_type TEXT,
    p_action_description TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.activity_log (
        user_id,
        user_type,
        action_type,
        action_description,
        entity_type,
        entity_id,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        p_user_id,
        p_user_type,
        p_action_type,
        p_action_description,
        p_entity_type,
        p_entity_id,
        p_metadata,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error inserting activity log: %', SQLERRM;
        RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_activity_log(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_activity_log(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION public.insert_activity_log IS 'Inserts an activity log entry, bypassing RLS for account creation and other activities';


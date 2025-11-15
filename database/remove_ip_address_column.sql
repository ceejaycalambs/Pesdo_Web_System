-- Remove IP Address column from activity_log and login_log tables
-- This script drops the ip_address column from both logging tables

-- Drop ip_address column from activity_log table
ALTER TABLE public.activity_log 
DROP COLUMN IF EXISTS ip_address;

-- Drop ip_address column from login_log table
ALTER TABLE public.login_log 
DROP COLUMN IF EXISTS ip_address;

-- Drop all existing insert_activity_log function overloads first
-- This is necessary because PostgreSQL requires explicit function signature when multiple overloads exist
-- Drop the version with ip_address parameter (9 parameters)
DROP FUNCTION IF EXISTS public.insert_activity_log(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TEXT);
-- Drop the version without ip_address parameter (8 parameters) if it exists
DROP FUNCTION IF EXISTS public.insert_activity_log(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT);

-- Create the new insert_activity_log RPC function without ip_address parameter
-- This matches the function signature from fix_activity_log_rls_for_signup.sql but without ip_address
CREATE OR REPLACE FUNCTION public.insert_activity_log(
    p_user_id UUID,
    p_user_type TEXT,
    p_action_type TEXT,
    p_action_description TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB,
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
        user_agent
    ) VALUES (
        p_user_id,
        p_user_type,
        p_action_type,
        p_action_description,
        p_entity_type,
        p_entity_id,
        p_metadata,
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
GRANT EXECUTE ON FUNCTION public.insert_activity_log(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_activity_log(UUID, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) TO anon;

COMMENT ON FUNCTION public.insert_activity_log IS 'Inserts an activity log entry, bypassing RLS for account creation and other activities';


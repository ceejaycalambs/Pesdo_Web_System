-- Add suspension duration and notes fields to employer_profiles
-- This allows admins to specify how long an employer is suspended and why

-- Step 1: Add suspension_duration_days column (NULL = indefinite suspension)
ALTER TABLE public.employer_profiles
ADD COLUMN IF NOT EXISTS suspension_duration_days INTEGER;

-- Step 2: Add suspension_started_at column to track when suspension began
ALTER TABLE public.employer_profiles
ADD COLUMN IF NOT EXISTS suspension_started_at TIMESTAMPTZ;

-- Step 3: Add suspension_notes column for admin notes about the suspension
ALTER TABLE public.employer_profiles
ADD COLUMN IF NOT EXISTS suspension_notes TEXT;

-- Step 4: Add comment to document the fields
COMMENT ON COLUMN public.employer_profiles.suspension_duration_days IS 
'Number of days the suspension lasts. NULL means indefinite suspension until manually unsuspended.';

COMMENT ON COLUMN public.employer_profiles.suspension_started_at IS 
'Timestamp when the suspension started. Used to calculate when suspension expires.';

COMMENT ON COLUMN public.employer_profiles.suspension_notes IS 
'Admin notes explaining why the employer was suspended.';

-- Step 5: Create a function to check if suspension has expired
CREATE OR REPLACE FUNCTION public.is_suspension_expired(p_employer_id uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_status TEXT;
    v_duration_days INTEGER;
    v_started_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT 
        verification_status,
        suspension_duration_days,
        suspension_started_at
    INTO v_status, v_duration_days, v_started_at
    FROM public.employer_profiles
    WHERE id = p_employer_id;

    -- If not suspended, return false
    IF v_status != 'suspended' THEN
        RETURN FALSE;
    END IF;

    -- If indefinite suspension (NULL duration), return false (not expired)
    IF v_duration_days IS NULL THEN
        RETURN FALSE;
    END IF;

    -- If no start date, return false (shouldn't happen, but handle it)
    IF v_started_at IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Calculate expiration date
    v_expires_at := v_started_at + (v_duration_days || ' days')::INTERVAL;

    -- Check if current time is past expiration
    RETURN NOW() >= v_expires_at;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_suspension_expired(uuid) TO authenticated;


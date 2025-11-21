-- Update Employer Verification Status Flow
-- This migration updates the employer profile creation to set initial status to 'unverified'
-- and provides a function to automatically update status based on document uploads

-- Step 0: Update the check constraint to allow 'unverified' and 'suspended' status
-- First, drop the existing constraint
ALTER TABLE public.employer_profiles 
DROP CONSTRAINT IF EXISTS check_verification_status;

-- Recreate the constraint with 'unverified' and 'suspended' included
ALTER TABLE public.employer_profiles
ADD CONSTRAINT check_verification_status 
CHECK (
  verification_status IS NULL OR 
  verification_status IN ('unverified', 'pending', 'under_review', 'approved', 'rejected', 'suspended')
);

-- Step 1: Update the create_employer_profile function to set verification_status to 'unverified'
CREATE OR REPLACE FUNCTION public.create_employer_profile(
    p_user_id uuid,
    p_email text,
    p_business_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    INSERT INTO public.employer_profiles (
        id,
        email,
        usertype,
        business_name,
        verification_status,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        p_email,
        'employer',
        p_business_name,
        'unverified',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        business_name = COALESCE(EXCLUDED.business_name, employer_profiles.business_name),
        updated_at = now();

    v_result := json_build_object(
        'status', 'success',
        'message', 'Profile created successfully',
        'user_id', p_user_id
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        v_result := json_build_object(
            'status', 'error',
            'message', SQLERRM,
            'user_id', p_user_id
        );
        RETURN v_result;
END;
$$;

-- Step 2: Create a function to automatically update verification status based on documents
-- This can be called after document uploads to check if status should change
CREATE OR REPLACE FUNCTION public.update_employer_verification_status(
    p_employer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status text;
    v_has_bir boolean;
    v_has_permit boolean;
BEGIN
    -- Get current status and document presence
    -- Check for both NULL and empty string to ensure documents are truly present
    SELECT 
        COALESCE(verification_status, 'unverified'),
        COALESCE(TRIM(bir_document_url), '') != '',
        COALESCE(TRIM(business_permit_url), '') != ''
    INTO v_current_status, v_has_bir, v_has_permit
    FROM public.employer_profiles
    WHERE id = p_employer_id;

    -- Debug: Log the values (remove in production if needed)
    -- RAISE NOTICE 'RPC Debug: status=%, has_bir=%, has_permit=%', v_current_status, v_has_bir, v_has_permit;

    -- Update status for 'unverified', 'pending', or 'rejected' (rejected can re-verify)
    -- Don't override admin decisions (approved/suspended) unless documents are removed
    IF v_current_status IN ('unverified', 'pending', 'rejected') THEN
        IF v_has_bir AND v_has_permit THEN
            -- Both documents present: set to 'pending' for admin review
            -- Force update even if status is already 'pending' to clear rejection notes
            UPDATE public.employer_profiles
            SET verification_status = 'pending',
                verification_notes = NULL,  -- Clear previous rejection notes when re-submitting
                updated_at = now()
            WHERE id = p_employer_id;
            
            -- Verify the update succeeded
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to update employer profile status';
            END IF;
        ELSIF NOT (v_has_bir AND v_has_permit) THEN
            -- Missing documents: set to 'unverified' (or keep 'rejected' if already rejected)
            IF v_current_status = 'rejected' THEN
                -- Keep rejected status if documents are removed after rejection
                -- Don't change status
                NULL;
            ELSE
                -- Set to 'unverified' if documents are missing
                UPDATE public.employer_profiles
                SET verification_status = 'unverified',
                    updated_at = now()
                WHERE id = p_employer_id;
            END IF;
        END IF;
    ELSIF v_current_status IN ('approved', 'suspended') THEN
        -- For approved/suspended: only revert if documents are removed
        IF NOT (v_has_bir AND v_has_permit) THEN
            -- Documents removed: set to 'unverified' (admin will need to re-verify)
            UPDATE public.employer_profiles
            SET verification_status = 'unverified',
                verification_notes = NULL,
                updated_at = now()
            WHERE id = p_employer_id;
        END IF;
    END IF;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.create_employer_profile(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_employer_profile(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_employer_verification_status(uuid) TO authenticated;

-- Step 3: (Optional) Update existing employer profiles
-- Set existing 'pending' employers without both documents to 'unverified'
-- This is a one-time migration for existing data
UPDATE public.employer_profiles
SET verification_status = 'unverified',
    updated_at = now()
WHERE verification_status = 'pending'
  AND (
    bir_document_url IS NULL 
    OR bir_document_url = '' 
    OR business_permit_url IS NULL 
    OR business_permit_url = ''
  );

-- Set existing employers with both documents but status 'unverified' to 'pending'
-- This handles cases where documents were uploaded but status wasn't updated
UPDATE public.employer_profiles
SET verification_status = 'pending',
    updated_at = now()
WHERE verification_status = 'unverified'
  AND bir_document_url IS NOT NULL 
  AND bir_document_url != ''
  AND business_permit_url IS NOT NULL 
  AND business_permit_url != '';


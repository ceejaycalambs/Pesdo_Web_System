-- Add 'suspended' status to employer verification
-- This allows admins to suspend approved employers without rejecting them

-- Step 1: Update the check constraint to include 'suspended'
ALTER TABLE public.employer_profiles 
DROP CONSTRAINT IF EXISTS check_verification_status;

-- Recreate the constraint with 'suspended' included
ALTER TABLE public.employer_profiles
ADD CONSTRAINT check_verification_status 
CHECK (
  verification_status IS NULL OR 
  verification_status IN ('unverified', 'pending', 'under_review', 'approved', 'rejected', 'suspended')
);

-- Step 2: Add comment to document the status flow
COMMENT ON COLUMN public.employer_profiles.verification_status IS 
'Verification status: unverified (initial), pending (docs uploaded), under_review (being reviewed), approved (can post jobs), rejected (initial verification failed), suspended (approved but temporarily disabled)';


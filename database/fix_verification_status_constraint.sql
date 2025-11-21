-- Fix verification_status constraint to include 'suspended'
-- This ensures the constraint allows all valid verification statuses including suspended
-- Run this in Supabase SQL editor if you get constraint violation errors

-- Step 1: Drop the existing constraint
ALTER TABLE public.employer_profiles 
DROP CONSTRAINT IF EXISTS check_verification_status;

-- Step 2: Recreate the constraint with all valid statuses including 'suspended'
ALTER TABLE public.employer_profiles
ADD CONSTRAINT check_verification_status 
CHECK (
  verification_status IS NULL OR 
  verification_status IN ('unverified', 'pending', 'under_review', 'approved', 'rejected', 'suspended')
);

-- Step 3: Update comment to document all statuses
COMMENT ON COLUMN public.employer_profiles.verification_status IS 
'Verification status: unverified (initial), pending (docs uploaded), under_review (being reviewed), approved (can post jobs), rejected (initial verification failed), suspended (approved but temporarily disabled)';


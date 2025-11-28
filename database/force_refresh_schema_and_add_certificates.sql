-- Force PostgREST schema refresh and add certificate columns
-- Run this in Supabase SQL Editor

-- Step 1: Add NC certificate columns (if they don't exist)
ALTER TABLE public.jobseeker_profiles
ADD COLUMN IF NOT EXISTS nc1_certificate_url text,
ADD COLUMN IF NOT EXISTS nc1_certificate_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS nc2_certificate_url text,
ADD COLUMN IF NOT EXISTS nc2_certificate_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS nc3_certificate_url text,
ADD COLUMN IF NOT EXISTS nc3_certificate_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS nc4_certificate_url text,
ADD COLUMN IF NOT EXISTS nc4_certificate_uploaded_at timestamptz;

-- Step 2: Add other_certificates column (if it doesn't exist)
ALTER TABLE public.jobseeker_profiles
ADD COLUMN IF NOT EXISTS other_certificates jsonb DEFAULT '[]'::jsonb;

-- Step 3: Add comments
COMMENT ON COLUMN public.jobseeker_profiles.nc1_certificate_url IS 'Public URL of NC I certificate';
COMMENT ON COLUMN public.jobseeker_profiles.nc2_certificate_url IS 'Public URL of NC II certificate';
COMMENT ON COLUMN public.jobseeker_profiles.nc3_certificate_url IS 'Public URL of NC III certificate';
COMMENT ON COLUMN public.jobseeker_profiles.nc4_certificate_url IS 'Public URL of NC IV certificate';
COMMENT ON COLUMN public.jobseeker_profiles.other_certificates IS 'Array of additional certificates with type and URL';

-- Step 4: Create index for other_certificates
CREATE INDEX IF NOT EXISTS idx_jobseeker_profiles_other_certificates 
ON public.jobseeker_profiles USING gin (other_certificates);

-- Step 5: Force PostgREST to reload schema by touching the table
-- This triggers PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';

-- Step 6: Verify columns were created
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'jobseeker_profiles'
  AND column_name LIKE '%certificate%'
ORDER BY column_name;



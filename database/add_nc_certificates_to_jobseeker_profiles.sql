-- Add NC I - NC IV certificate fields for jobseekers
-- Run in Supabase SQL editor

ALTER TABLE public.jobseeker_profiles
ADD COLUMN IF NOT EXISTS nc1_certificate_url text,
ADD COLUMN IF NOT EXISTS nc1_certificate_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS nc2_certificate_url text,
ADD COLUMN IF NOT EXISTS nc2_certificate_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS nc3_certificate_url text,
ADD COLUMN IF NOT EXISTS nc3_certificate_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS nc4_certificate_url text,
ADD COLUMN IF NOT EXISTS nc4_certificate_uploaded_at timestamptz;

COMMENT ON COLUMN public.jobseeker_profiles.nc1_certificate_url IS 'Public URL of NC I certificate';
COMMENT ON COLUMN public.jobseeker_profiles.nc2_certificate_url IS 'Public URL of NC II certificate';
COMMENT ON COLUMN public.jobseeker_profiles.nc3_certificate_url IS 'Public URL of NC III certificate';
COMMENT ON COLUMN public.jobseeker_profiles.nc4_certificate_url IS 'Public URL of NC IV certificate';



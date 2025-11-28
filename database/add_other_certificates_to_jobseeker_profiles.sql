-- Add JSONB column for storing multiple certificates with types
-- This allows jobseekers to upload various certificate types beyond NC I-IV
-- Run in Supabase SQL editor

ALTER TABLE public.jobseeker_profiles
ADD COLUMN IF NOT EXISTS other_certificates jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.jobseeker_profiles.other_certificates IS 'Array of additional certificates with type and URL. Format: [{"type": "Certificate Type", "url": "https://...", "uploaded_at": "2024-01-01T00:00:00Z", "file_name": "cert.pdf"}]';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_jobseeker_profiles_other_certificates ON public.jobseeker_profiles USING gin (other_certificates);



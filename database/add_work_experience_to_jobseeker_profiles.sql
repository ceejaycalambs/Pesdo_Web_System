-- Add work_experience_months column to jobseeker_profiles table
-- This field stores the jobseeker's total work experience in months
-- Run in Supabase SQL editor

ALTER TABLE public.jobseeker_profiles
ADD COLUMN IF NOT EXISTS work_experience_months INTEGER NULL;

COMMENT ON COLUMN public.jobseeker_profiles.work_experience_months IS 'Total work experience of the jobseeker in months (e.g., 24 = 2 years)';


-- Add age column to jobseeker_profiles table
ALTER TABLE public.jobseeker_profiles 
ADD COLUMN IF NOT EXISTS age INTEGER NULL;

-- Add a comment to the column
COMMENT ON COLUMN public.jobseeker_profiles.age IS 'Age of the jobseeker in years';


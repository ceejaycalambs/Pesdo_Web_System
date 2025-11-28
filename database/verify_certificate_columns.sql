-- Verify that certificate columns exist
-- Run this to check if columns were created successfully

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'jobseeker_profiles'
  AND column_name LIKE '%certificate%'
ORDER BY column_name;

-- If columns exist, you should see:
-- nc1_certificate_url, nc1_certificate_uploaded_at
-- nc2_certificate_url, nc2_certificate_uploaded_at
-- nc3_certificate_url, nc3_certificate_uploaded_at
-- nc4_certificate_url, nc4_certificate_uploaded_at
-- other_certificates



-- Fix RLS Policy for Profile Creation During Signup
-- This allows users to create their own profile during registration

-- Option 1: Create a function with SECURITY DEFINER (Recommended)
-- This function bypasses RLS to create profiles during signup

CREATE OR REPLACE FUNCTION public.create_jobseeker_profile(
    p_user_id uuid,
    p_email text,
    p_first_name text DEFAULT NULL,
    p_last_name text DEFAULT NULL,
    p_suffix text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    -- Insert profile with elevated privileges (bypasses RLS)
    INSERT INTO public.jobseeker_profiles (
        id,
        email,
        usertype,
        first_name,
        last_name,
        suffix,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        p_email,
        'jobseeker',
        p_first_name,
        p_last_name,
        p_suffix,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, jobseeker_profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, jobseeker_profiles.last_name),
        suffix = COALESCE(EXCLUDED.suffix, jobseeker_profiles.suffix),
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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_jobseeker_profile(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_jobseeker_profile(uuid, text, text, text, text) TO anon;

-- Similar function for employer profiles
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

-- Grant execution
GRANT EXECUTE ON FUNCTION public.create_employer_profile(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_employer_profile(uuid, text, text) TO anon;

-- Option 2: Alternative - Use Database Trigger (Automatic)
-- This automatically creates a profile when a user signs up
-- Uncomment if you prefer automatic profile creation

/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_type text;
BEGIN
    -- Get user type from metadata
    v_user_type := COALESCE(NEW.raw_user_meta_data->>'userType', 'jobseeker');

    -- Create profile based on user type
    IF v_user_type = 'employer' THEN
        INSERT INTO public.employer_profiles (id, email, usertype, created_at, updated_at)
        VALUES (NEW.id, NEW.email, 'employer', now(), now())
        ON CONFLICT (id) DO NOTHING;
    ELSIF v_user_type = 'admin' THEN
        INSERT INTO public.admin_profiles (id, email, usertype, created_at, updated_at)
        VALUES (NEW.id, NEW.email, 'admin', now(), now())
        ON CONFLICT (id) DO NOTHING;
    ELSE
        INSERT INTO public.jobseeker_profiles (id, email, usertype, created_at, updated_at)
        VALUES (NEW.id, NEW.email, 'jobseeker', now(), now())
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
*/


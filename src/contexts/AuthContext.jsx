import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabase';
import { logLogin, logActivity } from '../utils/activityLogger';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [accountTypeMismatch, setAccountTypeMismatch] = useState(false);
  
  // Refs for tracking auth state processing
  const isProcessingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const checkExistingSessionRunningRef = useRef(false);
  
  // Reset profileLoaded when user changes (important for refresh)
  useEffect(() => {
    if (!currentUser) {
      setProfileLoaded(false);
    }
  }, [currentUser]);

  // Helper function to fetch user profile
  // Checks jobseeker first (most common), then employer, then admin
  // Returns: { success: boolean, profile: object|null, userType: string|null }
  const fetchUserProfile = async (userId, email) => {
    try {
      console.log('📥 Fetching profile for:', email, 'User ID:', userId);
      
      // Check jobseeker first (most common user type)
      console.log('🔍 Querying jobseeker_profiles for ID:', userId);
      
      // Query with timeout protection
      const queryPromise = supabase
        .from('jobseeker_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 20 seconds')), 20000)
      );
      
      let jp, jpError;
      try {
        const result = await Promise.race([queryPromise, timeoutPromise]);
        jp = result.data;
        jpError = result.error;
      } catch (err) {
        if (err.message?.includes('timeout')) {
          console.error('⏱️ Jobseeker query timed out after 20 seconds');
          jpError = new Error('Query timeout - please check your connection');
          jp = null;
        } else {
          console.error('❌ Unexpected error in jobseeker query:', err);
          jpError = err;
          jp = null;
        }
      }
      
      console.log('📊 Jobseeker query result:', { 
        hasData: !!jp, 
        hasError: !!jpError, 
        error: jpError?.message,
        dataKeys: jp ? Object.keys(jp) : null
      });
      
      if (jpError) {
        console.error('❌ Error fetching jobseeker profile:', jpError);
        console.error('Error details:', {
          message: jpError.message,
          code: jpError.code,
          details: jpError.details,
          hint: jpError.hint
        });
        
        // If it's a timeout, try a simpler query or continue with fallback
        if (jpError.message?.includes('timeout')) {
          console.warn('⚠️ Query timed out - this may indicate an RLS or network issue');
          // Continue to check other profile types, but also set a basic profile so app can continue
        }
      }
      
      if (jp) {
        console.log('✅ Jobseeker profile loaded:', jp);
        const profileData = { ...jp, userType: jp.usertype || 'jobseeker' };
        setUserData(profileData);
        setProfileLoaded(true);
        console.log('✅ profileLoaded set to true');
        return { success: true, profile: profileData, userType: 'jobseeker' };
      }
      
      // If query timed out but we have a user ID, set basic profile to allow app to continue
      if (jpError?.message?.includes('timeout')) {
        console.warn('⚠️ Query timed out - setting basic profile to allow app to continue');
        const fallbackProfile = {
          id: userId,
          email: email,
          userType: 'jobseeker'
        };
        setUserData(fallbackProfile);
        setProfileLoaded(true);
        console.log('✅ Basic profile set (timeout fallback)');
        return { success: true, profile: fallbackProfile, userType: 'jobseeker' };
      }
      
      console.log('ℹ️ No jobseeker profile found, checking employer...');

      // Check employer with timeout protection
      console.log('🔍 Querying employer_profiles for ID:', userId);
      const employerQueryPromise = supabase
        .from('employer_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      const employerTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 20 seconds')), 20000)
      );
      
      let ep, epError;
      try {
        const result = await Promise.race([employerQueryPromise, employerTimeoutPromise]);
        ep = result.data;
        epError = result.error;
      } catch (err) {
        if (err.message?.includes('timeout')) {
          console.error('⏱️ Employer query timed out after 20 seconds');
          epError = new Error('Query timeout - please check your connection');
          ep = null;
        } else {
          console.error('❌ Unexpected error in employer query:', err);
          epError = err;
          ep = null;
        }
      }
      
      console.log('📊 Employer query result:', { 
        hasData: !!ep, 
        hasError: !!epError, 
        error: epError?.message,
        dataKeys: ep ? Object.keys(ep) : null
      });
      
      if (epError) {
        console.error('❌ Error fetching employer profile:', epError);
        console.error('Error details:', {
          message: epError.message,
          code: epError.code,
          details: epError.details,
          hint: epError.hint
        });
        
        if (epError.message?.includes('timeout')) {
          console.warn('⚠️ Employer query timed out - this may indicate an RLS or network issue');
        }
      }
      
      if (ep) {
        console.log('✅ Employer profile loaded:', ep);
        const profileData = { ...ep, userType: ep.usertype || 'employer' };
        setUserData(profileData);
        setProfileLoaded(true);
        console.log('✅ profileLoaded set to true');
        return { success: true, profile: profileData, userType: 'employer' };
      }
      
      // If employer query timed out but we have a user ID, set basic profile to allow app to continue
      if (epError?.message?.includes('timeout')) {
        console.warn('⚠️ Employer query timed out - setting basic profile to allow app to continue');
        const fallbackProfile = {
          id: userId,
          email: email,
          userType: 'employer'
        };
        setUserData(fallbackProfile);
        setProfileLoaded(true);
        console.log('✅ Basic employer profile set (timeout fallback)');
        return { success: true, profile: fallbackProfile, userType: 'employer' };
      }
      
      // Check admin by id with timeout protection
      console.log('ℹ️ No employer profile found, checking admin...');
      console.log('🔍 Querying admin_profiles for ID:', userId);
      
      const adminQueryPromise = supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      const adminTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 20 seconds')), 20000)
      );
      
      let ap, apErr;
      try {
        const result = await Promise.race([adminQueryPromise, adminTimeoutPromise]);
        ap = result.data;
        apErr = result.error;
      } catch (err) {
        if (err.message?.includes('timeout')) {
          console.error('⏱️ Admin query timed out after 20 seconds');
          apErr = new Error('Query timeout - please check your connection');
          ap = null;
        } else {
          console.error('❌ Unexpected error in admin query:', err);
          apErr = err;
          ap = null;
        }
      }
      
      console.log('📊 Admin query result:', { 
        hasData: !!ap, 
        hasError: !!apErr, 
        error: apErr?.message,
        dataKeys: ap ? Object.keys(ap) : null
      });

      if (apErr) {
        console.error('❌ Error fetching admin profile by ID:', apErr);
        console.error('Error details:', {
          message: apErr.message,
          code: apErr.code,
          details: apErr.details,
          hint: apErr.hint
        });
        
        if (apErr.message?.includes('timeout')) {
          console.warn('⚠️ Admin query timed out - this may indicate an RLS or network issue');
        }
      }

      // Fallback: admin by email with timeout protection
      if ((!ap || apErr) && email) {
        console.log('🔍 Trying admin profile by email:', email);
        const adminEmailQueryPromise = supabase
          .from('admin_profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        
        const adminEmailTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout after 20 seconds')), 20000)
        );
        
        try {
          const result = await Promise.race([adminEmailQueryPromise, adminEmailTimeoutPromise]);
          if (!result.error && result.data) {
            ap = result.data;
            apErr = null;
            console.log('✅ Admin profile found by email');
          } else if (result.error) {
            console.error('Error fetching admin profile by email:', result.error);
            if (!apErr) apErr = result.error;
          }
        } catch (err) {
          if (err.message?.includes('timeout')) {
            console.error('⏱️ Admin email query timed out after 20 seconds');
            if (!apErr) apErr = new Error('Query timeout - please check your connection');
          } else {
            console.error('❌ Unexpected error in admin email query:', err);
            if (!apErr) apErr = err;
          }
        }
      }
      
      // If admin query timed out but we have a user ID, set basic profile to allow app to continue
      if (apErr?.message?.includes('timeout') && !ap) {
        console.warn('⚠️ Admin query timed out - setting basic profile to allow app to continue');
        setUserData({
          id: userId,
          email: email,
          userType: 'admin',
          role: 'admin'
        });
        setProfileLoaded(true);
        console.log('✅ Basic admin profile set (timeout fallback)');
        return true;
      }

      if (ap) {
        const role = ap.role || 'admin';
        console.log('✅ Admin profile loaded:', { id: ap.id, email: ap.email, role });
        const profileData = {
          ...ap,
          userType: ap.userType || ap.usertype || 'admin',
          role,
          isSuperAdmin: role === 'super_admin'
        };
        setUserData(profileData);
        setProfileLoaded(true);
        console.log('✅ profileLoaded set to true');
        // Return the correct userType based on role
        const userTypeForLog = role === 'super_admin' ? 'super_admin' : 'admin';
        return { success: true, profile: profileData, userType: userTypeForLog, role };
      }
      
      // If admin query timed out but we have a user ID, set basic profile to allow app to continue
      if (apErr?.message?.includes('timeout') && !ap) {
        console.warn('⚠️ Admin query timed out - setting basic profile to allow app to continue');
        const fallbackProfile = {
          id: userId,
          email: email,
          userType: 'admin',
          role: 'admin'
        };
        setUserData(fallbackProfile);
        setProfileLoaded(true);
        console.log('✅ Basic admin profile set (timeout fallback)');
        return { success: true, profile: fallbackProfile, userType: 'admin', role: 'admin' };
      }

      // Default - no profile found, assume jobseeker
      const defaultProfile = {
        id: userId,
        email: email,
        userType: 'jobseeker'
      };
      setUserData(defaultProfile);
      setProfileLoaded(true);
      return { success: true, profile: defaultProfile, userType: 'jobseeker' };
    } catch (err) {
      console.error('Exception in fetchUserProfile:', err);
      // Even on error, set basic user data so app can continue
      const errorProfile = {
        id: userId,
        email: email,
        userType: 'jobseeker'
      };
      setUserData(errorProfile);
      setProfileLoaded(true);
      return { success: false, profile: errorProfile, userType: 'jobseeker' };
    }
  };

  // Session restoration is handled by onAuthStateChange with INITIAL_SESSION event
  // No separate restoreSession needed - Supabase handles this automatically

  // Sign up function
  async function signup(email, password, userType, additionalData = {}) {
    try {
      console.log('🔧 AuthContext: Starting signup for:', email);
      const sanitizedData = Object.fromEntries(
        Object.entries(additionalData)
          .filter(([key]) => key !== 'username')
          .map(([key, value]) => {
            if (typeof value === 'string') {
              const trimmed = value.trim();
              return [key, trimmed.length > 0 ? trimmed : null];
            }
            return [key, value];
          })
      );
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Ensure confirmation links point to the active origin (prod or dev)
          emailRedirectTo: (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : undefined,
          data: {
            userType: userType,
            ...sanitizedData
          }
        }
      });
      
      // Check if user was created even if email failed
      if (error) {
        console.error('❌ Signup error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name
        });
        
        // Handle "User already registered" error - check if profile exists
        if (error.message?.includes('already registered') || error.message?.includes('User already registered')) {
          console.log('🔍 User already registered - checking if profile exists...');
          
          // Check if profile exists for this email
          let profileExists = false;
          
          // Check jobseeker profiles
          const { data: jobseekerProfile } = await supabase
            .from('jobseeker_profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          
          if (jobseekerProfile) {
            profileExists = true;
            console.log('✅ Jobseeker profile exists for this email');
          } else {
            // Check employer profiles
            const { data: employerProfile } = await supabase
              .from('employer_profiles')
              .select('id')
              .eq('email', email)
              .maybeSingle();
            
            if (employerProfile) {
              profileExists = true;
              console.log('✅ Employer profile exists for this email');
            } else {
              // Check admin profiles
              const { data: adminProfile } = await supabase
                .from('admin_profiles')
                .select('id')
                .eq('email', email)
                .maybeSingle();
              
              if (adminProfile) {
                profileExists = true;
                console.log('✅ Admin profile exists for this email');
              } else {
                console.log('⚠️ No profile found - auth user exists but profile is deleted (orphaned)');
                console.log('🔧 Attempting to clean up orphaned auth user...');
                
                // Try to use an RPC function to delete the orphaned auth user by email
                try {
                  console.log('🔧 Calling delete_auth_user_by_email RPC function for:', email);
                  const { data: cleanupResult, error: cleanupError } = await supabase.rpc('delete_auth_user_by_email', {
                    user_email: email
                  });
                  
                  console.log('🔧 Cleanup RPC result:', { cleanupResult, cleanupError });
                  
                  if (cleanupError) {
                    console.error('⚠️ Failed to clean up orphaned auth user via RPC:', cleanupError);
                    console.error('⚠️ Cleanup error details:', {
                      message: cleanupError.message,
                      code: cleanupError.code,
                      details: cleanupError.details,
                      hint: cleanupError.hint
                    });
                    
                    // If RPC function doesn't exist or fails, provide helpful error message
                    if (cleanupError.message?.includes('function') || cleanupError.code === '42883' || cleanupError.message?.includes('does not exist')) {
                      throw new Error('The cleanup function is not set up. Please run the SQL script `database/delete_auth_user_by_email.sql` in Supabase SQL Editor first. Alternatively, contact an administrator to manually delete the orphaned auth user from the Supabase Dashboard (Authentication > Users).');
                    } else if (cleanupError.message?.includes('permission') || cleanupError.message?.includes('privilege')) {
                      throw new Error('Insufficient permissions to clean up the orphaned account. Please contact an administrator to manually delete the orphaned auth user from the Supabase Dashboard (Authentication > Users), or use a different email address.');
                    } else {
                      throw new Error(`Cleanup failed: ${cleanupError.message || 'Unknown error'}. Please contact an administrator to manually delete the orphaned auth user from the Supabase Dashboard (Authentication > Users), or use a different email address.`);
                    }
                  } else if (cleanupResult === true) {
                    console.log('✅ Orphaned auth user deleted successfully!');
                    // Wait a moment for Supabase to process the deletion
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // Retry the signup
                    console.log('🔄 Retrying signup after cleanup...');
                    return signup(email, password, userType, additionalData);
                  } else if (cleanupResult === false) {
                    console.log('⚠️ Cleanup function returned false - auth user may not exist or was already deleted, or permission denied');
                    // If cleanup returns false, it might mean:
                    // 1. The user doesn't exist (but Supabase Auth still thinks it does - caching issue)
                    // 2. Permission restrictions prevent deletion
                    // 3. The function needs to be run with service role
                    // 4. The user was already deleted but Supabase Auth hasn't updated yet
                    throw new Error('The cleanup function could not delete the orphaned account. This might be a Supabase caching issue.\n\nSOLUTIONS:\n1. Wait 1-2 minutes and try registering again (Supabase may need time to update)\n2. Clear your browser cache and cookies, then try again\n3. Ask an administrator to verify the user is deleted in Supabase Dashboard > Authentication > Users\n4. If the user still appears, delete it again and wait a few minutes\n5. Use a different email address to register\n\nIf the problem persists, this is likely a Supabase Auth caching issue that will resolve itself within a few minutes.');
                  } else {
                    console.log('⚠️ Cleanup function returned unexpected result:', cleanupResult);
                    throw new Error('Cleanup returned an unexpected result. Please contact an administrator to manually delete the orphaned auth user from the Supabase Dashboard (Authentication > Users), or use a different email address.');
                  }
                } catch (cleanupErr) {
                  // If it's our custom error, re-throw it
                  if (cleanupErr.message?.includes('orphaned') || cleanupErr.message?.includes('previously deleted') || cleanupErr.message?.includes('try registering again') || cleanupErr.message?.includes('cleaned up successfully') || cleanupErr.message?.includes('caching')) {
                    throw cleanupErr;
                  }
                  // Otherwise, provide a generic helpful error
                  console.error('⚠️ Error during cleanup attempt:', cleanupErr);
                  throw new Error('An account with this email was previously deleted, but the authentication record still exists. This might be a Supabase caching issue. Please wait 1-2 minutes and try again, or contact an administrator to verify the user is deleted in Supabase Dashboard (Authentication > Users).');
                }
              }
            }
          }
          
          if (profileExists) {
            // Profile exists, so this is a legitimate "already registered" error
            throw new Error('An account with this email already exists. Please use a different email or try logging in.');
          }
        }
        
        // Sometimes user is created but email fails - check if user exists
        if (data?.user) {
          console.log('⚠️ User was created but email failed. User ID:', data.user.id);
          console.log('⚠️ Email confirmed:', data.user.email_confirmed_at);
          // Continue with profile creation even if email failed
        } else {
          throw error;
        }
      }
      
      console.log('🔧 AuthContext: Signup successful for:', email);
      
      // Create user profile in Supabase using RPC function (bypasses RLS)
      if (data.user) {
        const userProfile = {
          id: data.user.id,
          email: data.user.email,
          usertype: userType, // Use lowercase to match database column
          ...sanitizedData
        };
        
        console.log('🔧 Creating profile using RPC function for user type:', userType);
        console.log('🔧 Profile data:', userProfile);
        
        // Use RPC function to create profile (bypasses RLS)
        let profileResult;
        if (userType === 'employer') {
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_employer_profile', {
            p_user_id: data.user.id,
            p_email: data.user.email,
            p_business_name: sanitizedData.business_name || null
          });
          profileResult = { data: rpcData, error: rpcError };
        } else if (userType === 'admin') {
          // Admin profiles might need different handling
          const { data: insertData, error: profileError } = await supabase
            .from('admin_profiles')
            .insert([userProfile])
            .select();
          profileResult = { data: insertData, error: profileError };
        } else {
          // Jobseeker profile
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_jobseeker_profile', {
            p_user_id: data.user.id,
            p_email: data.user.email,
            p_first_name: sanitizedData.first_name || null,
            p_last_name: sanitizedData.last_name || null,
            p_suffix: sanitizedData.suffix || null
          });
          profileResult = { data: rpcData, error: rpcError };
        }
        
        if (profileResult.error) {
          console.error('❌ Profile creation failed:', profileResult.error);
          console.error('❌ Error details:', {
            message: profileResult.error.message,
            details: profileResult.error.details,
            hint: profileResult.error.hint,
            code: profileResult.error.code
          });
          // Don't throw error - user account is created, profile can be created later
        } else {
          console.log('✅ Profile created successfully');
          console.log('✅ Profile result:', profileResult.data);
          
          // Log account creation activity with name
          try {
            const actionType = 'account_created';
            let actionDescription;
            
            if (userType === 'jobseeker') {
              const jobseekerName = sanitizedData.first_name && sanitizedData.last_name
                ? `${sanitizedData.first_name} ${sanitizedData.last_name}`.trim()
                : email;
              actionDescription = `Jobseeker account created: ${jobseekerName}`;
            } else if (userType === 'employer') {
              const employerName = sanitizedData.business_name || sanitizedData.contact_person_name || email;
              actionDescription = `Employer account created: ${employerName}`;
            } else {
              actionDescription = `Account created: ${email}`;
            }
            
            console.log('📝 Logging account creation activity:', {
              userId: data.user.id,
              userType: userType,
              actionType: actionType,
              actionDescription: actionDescription,
              email: email
            });
            
            await logActivity({
              userId: data.user.id,
              userType: userType,
              actionType: actionType,
              actionDescription: actionDescription,
              entityType: 'profile',
              entityId: data.user.id,
              metadata: {
                email: email,
                accountType: userType,
                ...(userType === 'jobseeker' && sanitizedData.first_name ? {
                  firstName: sanitizedData.first_name,
                  lastName: sanitizedData.last_name
                } : {}),
                ...(userType === 'employer' && sanitizedData.business_name ? {
                  businessName: sanitizedData.business_name
                } : {})
              }
            });
            console.log('✅ Account creation logged to activity log successfully');
          } catch (logError) {
            console.error('⚠️ Failed to log account creation activity:', logError);
            console.error('⚠️ Error details:', {
              message: logError.message,
              stack: logError.stack,
              error: logError
            });
            // Don't throw - logging failure shouldn't break registration
          }
        }
        
        // Update local state
        setUserData(userProfile);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Check account type after authentication but before setting user state
  async function checkAccountTypeAfterAuth(userId, expectedUserType, userEmail = null) {
    if (!expectedUserType) {
      console.log('⚠️ No expected user type provided, skipping validation');
      return true; // No validation needed if no expected type
    }
    
    console.log('🔍 Checking account type for user ID:', userId, 'Expected:', expectedUserType);
    
    // Check the appropriate table first based on expected user type
    if (expectedUserType === 'admin') {
      let adminResult = await supabase
        .from('admin_profiles')
        .select('usertype, role')
        .eq('id', userId)
        .maybeSingle();

      // If not found by id (or RLS hides it), try by email as fallback
      if ((!adminResult || !adminResult.data) && userEmail) {
        const byEmail = await supabase
          .from('admin_profiles')
          .select('usertype, role')
          .eq('email', userEmail)
          .maybeSingle();
        if (byEmail && byEmail.data) {
          adminResult = byEmail;
        }
      }

      if (adminResult && adminResult.data) {
        const actualUserType = adminResult.data.usertype || 'admin';
        console.log('📋 Found in admin_profiles:', actualUserType);
        
        if (expectedUserType !== actualUserType) {
          console.log('❌ Account type mismatch! Expected:', expectedUserType, 'Found:', actualUserType);
          throw new Error(`This account is registered as an ${actualUserType}. Please use the ${actualUserType} login instead.`);
        }
        console.log('✅ Account type matches, proceeding with login');
        return true;
      }
    } else if (expectedUserType === 'employer') {
      const employerResult = await supabase
        .from('employer_profiles')
        .select('usertype')
        .eq('id', userId)
        .maybeSingle();

      if (!employerResult.error && employerResult.data) {
        const actualUserType = employerResult.data.usertype || 'employer';
        console.log('📋 Found in employer_profiles:', actualUserType);
        
        if (expectedUserType !== actualUserType) {
          console.log('❌ Account type mismatch! Expected:', expectedUserType, 'Found:', actualUserType);
          throw new Error(`This account is registered as an ${actualUserType}. Please use the ${actualUserType} login instead.`);
        }
        console.log('✅ Account type matches, proceeding with login');
        return true;
      }
    } else if (expectedUserType === 'jobseeker') {
      const jobseekerResult = await supabase
        .from('jobseeker_profiles')
        .select('usertype')
        .eq('id', userId)
        .maybeSingle();

      if (!jobseekerResult.error && jobseekerResult.data) {
        const actualUserType = jobseekerResult.data.usertype || 'jobseeker';
        console.log('📋 Found in jobseeker_profiles:', actualUserType);
        
        if (expectedUserType !== actualUserType) {
          console.log('❌ Account type mismatch! Expected:', expectedUserType, 'Found:', actualUserType);
          throw new Error(`This account is registered as an ${actualUserType}. Please use the ${actualUserType} login instead.`);
        }
        console.log('✅ Account type matches, proceeding with login');
        return true;
      }
    }

    // If not found in the expected table, check other tables for mismatch
    if (expectedUserType !== 'admin') {
      const adminResult = await supabase
        .from('admin_profiles')
        .select('userType')
        .eq('id', userId)
        .maybeSingle();

      if (!adminResult.error && adminResult.data) {
        const actualUserType = adminResult.data.userType || 'admin';
        console.log('❌ Account type mismatch! Expected:', expectedUserType, 'Found:', actualUserType);
        throw new Error(`This account is registered as an ${actualUserType}. Please use the ${actualUserType} login instead.`);
      }
    }

    // If not found in admin_profiles, try employer_profiles
    const employerResult = await supabase
      .from('employer_profiles')
      .select('usertype')
      .eq('id', userId)
      .single();

    console.log('🔍 Employer profile check result:', {
      error: employerResult.error?.message,
      data: employerResult.data,
      hasData: !!employerResult.data
    });

    if (!employerResult.error && employerResult.data) {
      const actualUserType = employerResult.data.usertype || 'employer';
      console.log('📋 Found in employer_profiles:', actualUserType);
      
      if (expectedUserType !== actualUserType) {
        console.log('❌ Account type mismatch! Expected:', expectedUserType, 'Found:', actualUserType);
        throw new Error(`This account is registered as an ${actualUserType}. Please use the ${actualUserType} login instead.`);
      }
      console.log('✅ Account type matches, proceeding with login');
      return true;
    }

    // If not found in employer_profiles, try jobseeker_profiles
    const jobseekerResult = await supabase
      .from('jobseeker_profiles')
      .select('usertype')
      .eq('id', userId)
      .single();

    console.log('🔍 Jobseeker profile check result:', {
      error: jobseekerResult.error?.message,
      data: jobseekerResult.data,
      hasData: !!jobseekerResult.data
    });

    if (!jobseekerResult.error && jobseekerResult.data) {
      const actualUserType = jobseekerResult.data.usertype || 'jobseeker';
      console.log('📋 Found in jobseeker_profiles:', actualUserType);
      
      if (expectedUserType !== actualUserType) {
        console.log('❌ Account type mismatch! Expected:', expectedUserType, 'Found:', actualUserType);
        throw new Error(`This account is registered as a ${actualUserType}. Please use the ${actualUserType} login instead.`);
      }
      console.log('✅ Account type matches, proceeding with login');
      return true;
    }

    // If not found in either table, treat as not found (but don't mislabel as deleted for admins)
    if (expectedUserType === 'admin') {
      console.error('❌ Admin profile not found during validation');
      throw new Error('Admin profile not found for this account. Please ensure your admin profile exists and matches your auth email.');
    }
    
    // If no expected user type, allow login (new user or legacy account)
    console.log('📋 Account not found in profile tables, allowing login (no expected user type)');
    return true;
  }

  // Login function
  async function login(email, password, expectedUserType = null) {
    try {
      console.log('Starting login process for email:', email);
      console.log('Supabase URL:', supabase.supabaseUrl);
      
      // Don't clear session - Supabase will handle session replacement automatically
      // Only clear admin localStorage items
      
      // Clear any admin localStorage items to prevent conflicts
      localStorage.removeItem('admin_authenticated');
      localStorage.removeItem('admin_login_time');
      localStorage.removeItem('admin_email');
      
      // Set flags to prevent onAuthStateChange from interfering
      setIsLoggingIn(true);
      setAccountTypeMismatch(false);
      
      
      // Skip account type check before authentication - we'll do it after
      
      // Try direct auth call without timeout first
      console.log('Calling Supabase auth...');
      
      // Use Supabase client for proper email confirmation checking
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        // Log failed login attempt
        await logLogin({
          userId: null,
          userType: expectedUserType || 'unknown',
          email: email,
          status: 'failed',
          failureReason: authError.message || 'Authentication failed'
        });
        
        // Check if error is about email confirmation
        if (authError.message?.includes('Email not confirmed') || 
            authError.message?.includes('email_not_confirmed') ||
            authError.message?.includes('Email address not confirmed') ||
            authError.message?.includes('email_not_verified')) {
          throw new Error('Email not confirmed. Please check your email and click the confirmation link before logging in.');
        }
        throw authError;
      }
      
      // Additional check: Verify email is confirmed (double-check)
      if (authData.user && !authData.user.email_confirmed_at && !authData.user.confirmed_at) {
        // Sign out the user if email is not confirmed
        await supabase.auth.signOut();
        console.warn('⚠️ Login attempt with unconfirmed email:', email);
        throw new Error('Email not confirmed. Please check your email and click the confirmation link before logging in.');
      }
      
      // Create user object from response
      const user = {
        id: authData.user.id,
        email: authData.user.email,
        user_metadata: authData.user.user_metadata,
        email_confirmed_at: authData.user.email_confirmed_at || authData.user.confirmed_at
      };
      
      const data = { user, session: authData.session };
      
      console.log('Supabase auth response received:', { 
        hasData: !!data, 
        userEmail: data?.user?.email,
        userId: data?.user?.id,
        emailConfirmed: !!(authData.user.email_confirmed_at || authData.user.confirmed_at)
      });

      console.log('Auth successful, setting session for account type validation...');
      
      // Session is already set by signInWithPassword, no need to set again
      
      // Check account type AFTER setting session but BEFORE setting user state
      if (expectedUserType) {
        console.log('🔍 About to check account type for user ID:', data.user.id, 'Expected:', expectedUserType);
        await checkAccountTypeAfterAuth(data.user.id, expectedUserType, data.user.email);
        console.log('✅ Account type check passed, proceeding with login');
      } else {
        console.log('⚠️ No expected user type, skipping account type validation');
      }
      
      // Removed global banner and automatic welcome email

      console.log('Setting user state...');
      setCurrentUser(data.user);
      
      console.log('Supabase auth successful, fetching user profile...');
      
      // Set basic user data immediately (profile can be fetched later)
      if (data.user) {
        console.log('Setting basic user data for:', data.user.email);
        
        // Try admin first, then employer, then jobseeker
        // Use fetchUserProfile for consistency and timeout protection
        const profileResult = await fetchUserProfile(data.user.id, email);
        
        // Determine userType for login log from the profile result
        let logUserType = expectedUserType || 'jobseeker';
        
        if (profileResult && profileResult.success) {
          // Use the userType directly from the fetch result
          if (profileResult.userType) {
            logUserType = profileResult.userType;
          } else if (profileResult.role === 'super_admin') {
            logUserType = 'super_admin';
          } else if (profileResult.profile?.role === 'super_admin') {
            logUserType = 'super_admin';
          } else if (profileResult.profile?.userType === 'admin' || profileResult.profile?.role === 'admin') {
            logUserType = 'admin';
          } else if (profileResult.profile?.userType === 'employer') {
            logUserType = 'employer';
          } else {
            logUserType = profileResult.profile?.userType || 'jobseeker';
          }
        }
        
        // Log successful login - this will always happen even if timeout fallback was used
        await logLogin({
          userId: data.user.id,
          userType: logUserType,
          email: email,
          status: 'success'
        });
        
        console.log('✅ Login logged successfully for:', logUserType);
      }
      
      console.log('Login process completed successfully');
      return data;
    } catch (error) {
      console.error('Login error details:', error);
      
      // If account type validation failed or account was deleted, clear the session and user state
      if (error.message?.includes('This account is registered as') || 
          error.message?.includes('account has been deleted')) {
        console.log('🧹 Clearing session and user state due to validation failure');
        setAccountTypeMismatch(true);
        
        // Clear user state immediately to prevent any redirects
        setCurrentUser(null);
        setUserData(null);
        setProfileLoaded(false);
        
        // Sign out from Supabase to completely clear the session
        await supabase.auth.signOut();
        
        // Clear the accountTypeMismatch flag after a delay to allow normal auth state changes later
        setTimeout(() => {
          console.log('🔄 Clearing accountTypeMismatch flag after delay');
          setAccountTypeMismatch(false);
        }, 5000); // Increased delay to 5 seconds to ensure complete cleanup
      }
      
      throw error;
    } finally {
      // Always clear the login flag
      setIsLoggingIn(false);
    }
  }

  // Logout function
  async function logout(skipRedirect = false) {
    try {
      console.log('Starting logout process...', { skipRedirect });
      
      // Clear user data immediately
      setCurrentUser(null);
      setUserData(null);
      setProfileLoaded(false);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Supabase logout error:', error);
      }
      
      // Clear any remaining session data
      await supabase.auth.setSession({
        access_token: null,
        refresh_token: null
      });
      
      console.log('Logout completed successfully');
      
      if (!skipRedirect) {
        window.location.href = '/';
      }
      
    } catch (error) {
      console.error('Logout error:', error);
      if (!skipRedirect) {
        window.location.href = '/';
      }
    }
  }

  // Update user profile
  async function updateUserProfile(updates) {
    try {
      console.log('🔧 AuthContext: Updating user profile:', updates);
      console.log('🔧 AuthContext: Current user ID:', currentUser?.id);
      
      if (currentUser) {
        const { data, error } = await supabase
          .from('jobseeker_profiles')
          .update(updates)
          .eq('id', currentUser.id)
          .select();
        
        if (error) {
          console.error('❌ AuthContext: Database update error:', error);
          throw error;
        }
        
        console.log('✅ AuthContext: Database update successful:', data);
        
        // Update local state
        setUserData(prev => {
          const updated = { ...prev, ...updates };
          console.log('🔄 AuthContext: Local state updated:', updated);
          return updated;
        });
      } else {
        console.error('❌ AuthContext: No current user found');
        throw new Error('No authenticated user');
      }
    } catch (error) {
      console.error('❌ AuthContext: Profile update failed:', error);
      throw error;
    }
  }

  // Update user profile picture
  async function updateProfilePicture(photoURL) {
    try {
      if (currentUser) {
        console.log('🖼️ Updating profile picture in database:', photoURL);
        
        const { data, error } = await supabase
          .from('jobseeker_profiles')
          .update({ profile_picture_url: photoURL })
          .eq('id', currentUser.id)
          .select();
        
        if (error) {
          console.error('❌ Database update error:', error);
          throw error;
        }
        
        console.log('✅ Database update successful:', data);
        
        // Update local state
        console.log('🔄 Updating local userData state with new profile picture URL');
        setUserData(prev => {
          const updated = { ...prev, profile_picture_url: photoURL };
          console.log('📊 Local state updated:', { 
            old: prev.profile_picture_url, 
            new: updated.profile_picture_url 
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('❌ updateProfilePicture error:', error);
      throw error;
    }
  }

  // Refresh user profile data with retry
  async function refreshUserProfile(retryCount = 0) {
    try {
      if (currentUser && userData) {
        console.log(`🔄 Refreshing user profile (attempt ${retryCount + 1})`);
        
        // Determine the correct table based on user type
        const tableName = userData.usertype === 'admin' ? 'admin_profiles' : 
                         userData.usertype === 'employer' ? 'employer_profiles' : 'jobseeker_profiles';
        
        console.log(`📋 Fetching from table: ${tableName} for user type: ${userData.usertype}`);
        
        const { data: profile, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (error) {
          if (retryCount < 2) {
            console.log(`⚠️ Profile fetch failed, retrying in 1 second... (${retryCount + 1}/3)`);
            setTimeout(() => refreshUserProfile(retryCount + 1), 1000);
            return;
          }
          throw error;
        }
        
        console.log('📊 Fresh profile data from database:', {
          profile_picture_url: profile.profile_picture_url,
          company_logo_url: profile.company_logo_url,
          resume_url: profile.resume_url
        });
        
        // Update local state with fresh data
        setUserData(prev => {
          const updated = { ...prev, ...profile };
          console.log('🔄 Local state updated with fresh data:', {
            old_profile_picture: prev.profile_picture_url,
            new_profile_picture: updated.profile_picture_url,
            old_company_logo: prev.company_logo_url,
            new_company_logo: updated.company_logo_url
          });
          return updated;
        });
        console.log('✅ User profile refreshed successfully');
      }
    } catch (error) {
      console.error('❌ Error refreshing user profile after retries:', error);
    }
  }

  // First, check for existing session on mount (before setting up listener)
  useEffect(() => {
    let isMounted = true;
    
    const checkExistingSession = async () => {
      try {
        checkExistingSessionRunningRef.current = true;
        console.log('🔍 Checking for existing session in localStorage...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) {
          checkExistingSessionRunningRef.current = false;
          return;
        }
        
        if (error) {
          console.error('❌ Error getting session:', error);
          checkExistingSessionRunningRef.current = false;
          return;
        }
        
        if (session?.user) {
          // Skip if we already have this user's profile loaded
          if (hasInitializedRef.current && currentUser?.id === session.user.id && profileLoaded) {
            console.log('ℹ️ Profile already loaded, skipping checkExistingSession fetch');
            checkExistingSessionRunningRef.current = false;
            return;
          }
          console.log('✅ Found existing session on mount, fetching profile:', session.user.email);
          setCurrentUser(session.user);
          setProfileLoaded(false); // Reset to ensure fresh fetch
          const profileResult = await fetchUserProfile(session.user.id, session.user.email);
          console.log('📊 checkExistingSession - Profile fetch completed:', profileResult?.success ? 'Success' : 'Failed');
          if (isMounted) {
            hasInitializedRef.current = true;
          }
        } else {
          console.log('ℹ️ No existing session found on mount');
        }
        checkExistingSessionRunningRef.current = false;
      } catch (err) {
        console.error('❌ Error checking existing session:', err);
        checkExistingSessionRunningRef.current = false;
      }
    };
    
    checkExistingSession();
    
    return () => {
      isMounted = false;
    };
  }, []); // Run once on mount

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, 'Has user:', !!session?.user);
      
      // Skip processing if we're in the middle of a login process or had account type mismatch
      if (isLoggingIn || accountTypeMismatch) {
        console.log('⏸️ Skipping - login in progress or account type mismatch');
        return;
      }
      
      // If this is a SIGNED_OUT event after a mismatch, don't process it
      if (event === 'SIGNED_OUT' && accountTypeMismatch) {
        return;
      }
      
      // Skip SIGNED_IN during initialization if:
      // 1. Profile is already loaded for this user, OR
      // 2. checkExistingSession is currently running (will handle the profile fetch)
      if (event === 'SIGNED_IN') {
        if (hasInitializedRef.current && currentUser?.id === session?.user?.id && profileLoaded) {
          console.log('ℹ️ Profile already loaded, skipping SIGNED_IN during initialization');
          return;
        }
        if (checkExistingSessionRunningRef.current) {
          console.log('ℹ️ checkExistingSession is running, skipping SIGNED_IN to avoid duplicate fetch');
          return;
        }
      }
      
      // Prevent concurrent processing (but always allow INITIAL_SESSION to process on refresh)
      if (isProcessingRef.current && event !== 'INITIAL_SESSION') {
        console.log('⏸️ Already processing, skipping:', event);
        return;
      }
      
      isProcessingRef.current = true;
      
      try {
        // Handle logout events
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing state');
          setCurrentUser(null);
          setUserData(null);
          setProfileLoaded(false);
          hasInitializedRef.current = false;
          isProcessingRef.current = false;
          return;
        }
        
        // Handle token refresh (automatic - Supabase refreshes tokens before expiry)
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Token refreshed automatically');
          isProcessingRef.current = false;
          return;
        }
        
        // Handle INITIAL_SESSION (page refresh) - this is critical for persistent auth
        if (event === 'INITIAL_SESSION') {
          console.log('🔄 INITIAL_SESSION - Restoring session on page refresh');
          if (session?.user) {
            // Skip if we already have this user's profile loaded
            if (hasInitializedRef.current && currentUser?.id === session.user.id && profileLoaded) {
              console.log('ℹ️ Profile already loaded for this user, skipping INITIAL_SESSION fetch');
              isProcessingRef.current = false;
              return;
            }
            console.log('✅ Session found, fetching profile for:', session.user.email);
            setCurrentUser(session.user);
            setProfileLoaded(false); // Reset to ensure fresh fetch
            const profileResult = await fetchUserProfile(session.user.id, session.user.email);
            console.log('📊 INITIAL_SESSION - Profile fetch completed:', profileResult?.success ? 'Success' : 'Failed');
            hasInitializedRef.current = true;
            isProcessingRef.current = false;
            return;
          } else {
            console.log('ℹ️ No session found on INITIAL_SESSION');
            setCurrentUser(null);
            setUserData(null);
            setProfileLoaded(false);
            isProcessingRef.current = false;
            return;
          }
        }
        
        // Handle SIGNED_IN events (explicit login)
        // Skip if profile is already loaded for this user
        if (session?.user && hasInitializedRef.current && currentUser?.id === session.user.id && profileLoaded) {
          console.log('ℹ️ Profile already loaded for SIGNED_IN, skipping fetch');
          isProcessingRef.current = false;
          return;
        }
        
        setCurrentUser(session?.user || null);
        
        if (session?.user) {
          console.log('🔄 SIGNED_IN - Fetching profile for:', session.user.email);
          const profileResult = await fetchUserProfile(session.user.id, session.user.email);
          console.log('📊 SIGNED_IN - Profile fetch completed:', profileResult?.success ? 'Success' : 'Failed');
          hasInitializedRef.current = true;
          isProcessingRef.current = false;
        } else {
          // No session - clear state
          setUserData(null);
          setProfileLoaded(false);
          isProcessingRef.current = false;
        }
      } catch (error) {
        console.error('❌ Error in auth state handler:', error);
        isProcessingRef.current = false;
      }
    });

    return () => subscription?.unsubscribe();
  }, [isLoggingIn, accountTypeMismatch]);

  const value = useMemo(() => ({
    currentUser,
    userData,
    profileLoaded,
    signup,
    register: signup, // Alias for compatibility
    login,
    logout,
    updateUserProfile,
    updateProfilePicture,
    refreshUserProfile
  }), [currentUser, userData, profileLoaded]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

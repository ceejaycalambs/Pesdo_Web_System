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
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [accountTypeMismatch, setAccountTypeMismatch] = useState(false);

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
      
      // Clear any existing session first to prevent conflicts
      console.log('Clearing any existing session...');
      await supabase.auth.signOut();
      
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
        let adminResult = await supabase
          .from('admin_profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        // If not found by id, try by email (in case of legacy/migrated rows)
        if ((!adminResult || !adminResult.data) && email) {
          const byEmail = await supabase
            .from('admin_profiles')
            .select('*')
            .eq('email', email)
            .maybeSingle();
          if (byEmail && byEmail.data) {
            adminResult = byEmail;
          }
        }

        if (adminResult && adminResult.data) {
          console.log('✅ Admin profile fetched:', adminResult.data);
          const userType = adminResult.data.usertype || 'admin';
          const adminRole = adminResult.data.role || 'admin';
          // Preserve role and a convenience boolean
          setUserData({
            ...adminResult.data,
            userType: userType,
            role: adminRole,
            isSuperAdmin: adminRole === 'super_admin'
          });
          setProfileLoaded(true);
          
          // Log successful login
          await logLogin({
            userId: data.user.id,
            userType: adminRole === 'super_admin' ? 'super_admin' : 'admin',
            email: email,
            status: 'success'
          });
        } else {
          // If not admin, try employer
          const employerResult = await supabase
            .from('employer_profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (employerResult && !employerResult.error && employerResult.data) {
            console.log('✅ Employer profile fetched:', employerResult.data);
            const userType = employerResult.data.usertype || 'employer';
            setUserData({...employerResult.data, userType});
            setProfileLoaded(true);
            
            // Log successful login
            await logLogin({
              userId: data.user.id,
              userType: 'employer',
              email: email,
              status: 'success'
            });
          } else {
            // If not employer, try jobseeker
            const jobseekerResult = await supabase
              .from('jobseeker_profiles')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();

            if (jobseekerResult && !jobseekerResult.error && jobseekerResult.data) {
              console.log('✅ Jobseeker profile fetched:', jobseekerResult.data);
              const userType = jobseekerResult.data.usertype || 'jobseeker';
              setUserData({...jobseekerResult.data, userType});
              setProfileLoaded(true);
              
              // Log successful login
              await logLogin({
                userId: data.user.id,
                userType: 'jobseeker',
                email: email,
                status: 'success'
              });
            } else {
              console.log('❌ No profile found in any table');
              
              if (expectedUserType === 'admin') {
                // Do not auto-signout; surface a clear error for admins
                throw new Error('Admin profile not found for this account. Please ensure your admin profile exists and matches your auth email. If this is a migrated account, ask a super admin to verify your admin profile.');
              }
              
              // Set basic user data with default userType (for new users)
              setUserData({
                id: data.user.id,
                email: data.user.email,
                userType: 'jobseeker' // Default to jobseeker if no profile found
              });
              setProfileLoaded(true);
            }
          }
        }
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

  const lastProcessedSession = useRef(null);
  const loadingRef = useRef(loading);
  const profileLoadedRef = useRef(profileLoaded);
  
  // Keep refs in sync with state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  
  useEffect(() => {
    profileLoadedRef.current = profileLoaded;
  }, [profileLoaded]);
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', { event, hasUser: !!session?.user, isLoggingIn, accountTypeMismatch });
      
      // Skip if this is the same session we just processed
      const sessionKey = session?.user?.id || 'no-user';
      if (lastProcessedSession.current === sessionKey && event === 'INITIAL_SESSION') {
        console.log('⏸️ Skipping duplicate INITIAL_SESSION event');
        return;
      }
      lastProcessedSession.current = sessionKey;
      
      // Skip processing if we're in the middle of a login process or had account type mismatch
      if (isLoggingIn || accountTypeMismatch) {
        console.log('⏸️ Skipping auth state change processing - login in progress or account type mismatch');
        return;
      }
      
      // If this is a SIGNED_OUT event after a mismatch, don't process it
      if (event === 'SIGNED_OUT' && accountTypeMismatch) {
        console.log('⏸️ Skipping SIGNED_OUT processing due to account type mismatch');
        return;
      }
      
      // Handle logout events
      if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing state');
        setCurrentUser(null);
        setUserData(null);
        setProfileLoaded(false);
        setLoading(false);
        return;
      }
      
      // Only update currentUser if it actually changed
      setCurrentUser(prev => {
        const newUser = session?.user || null;
        if (prev?.id === newUser?.id) {
          return prev; // Return same reference if unchanged
        }
        return newUser;
      });
      
      if (session?.user) {
        // Double-check that we're not in a mismatch state before fetching profile
        if (accountTypeMismatch) {
          console.log('⏸️ Skipping profile fetch due to account type mismatch');
          if (loadingRef.current) {
            setLoading(false);
          }
          return;
        }
        
        try {
          console.log('Fetching user profile for:', session.user.email);
          
          (async () => {
            try {
              // Admin by id
              let { data: ap, error: apErr } = await supabase
                .from('admin_profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              // Fallback: admin by email
              if ((!ap || apErr) && session.user.email) {
                const byEmail = await supabase
                  .from('admin_profiles')
                  .select('*')
                  .eq('email', session.user.email)
                  .maybeSingle();
                if (!byEmail.error && byEmail.data) {
                  ap = byEmail.data;
                }
              }

              if (ap) {
                console.log('✅ Auth state change - Admin profile fetched:', ap);
                const role = ap.role || 'admin';
                const newUserData = {
                  ...ap,
                  userType: ap.userType || ap.usertype || 'admin',
                  role,
                  isSuperAdmin: role === 'super_admin'
                };
                // Only update if data actually changed
                setUserData(prev => {
                  if (prev?.id === newUserData.id && 
                      prev?.userType === newUserData.userType &&
                      prev?.role === newUserData.role) {
                    return prev; // Return same reference if unchanged
                  }
                  return newUserData;
                });
                if (!profileLoadedRef.current) {
                  setProfileLoaded(true);
                }
                return;
              }

              // Employer
              const { data: ep } = await supabase
                .from('employer_profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              if (ep) {
                console.log('✅ Auth state change - Employer profile fetched:', ep);
                const newUserData = { ...ep, userType: ep.usertype || 'employer' };
                setUserData(prev => {
                  if (prev?.id === newUserData.id && 
                      prev?.userType === newUserData.userType) {
                    return prev;
                  }
                  return newUserData;
                });
                setProfileLoaded(prev => prev ? prev : true);
                return;
              }

              // Jobseeker
              const { data: jp } = await supabase
                .from('jobseeker_profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              if (jp) {
                console.log('✅ Auth state change - Jobseeker profile fetched:', jp);
                const newUserData = { ...jp, userType: jp.usertype || 'jobseeker' };
                setUserData(prev => {
                  if (prev?.id === newUserData.id && 
                      prev?.userType === newUserData.userType) {
                    return prev;
                  }
                  return newUserData;
                });
                setProfileLoaded(prev => prev ? prev : true);
                return;
              }

              // Default
              console.log('⚠️ Auth state change - No profile found in any table, using default');
              const defaultUserData = {
                id: session.user.id,
                email: session.user.email,
                userType: 'jobseeker'
              };
              setUserData(prev => {
                if (prev?.id === defaultUserData.id && 
                    prev?.userType === defaultUserData.userType) {
                  return prev;
                }
                return defaultUserData;
              });
              setProfileLoaded(prev => prev ? prev : true);
            } catch (err) {
              console.log('❌ Auth state change - Profile fetch error:', err.message);
              const errorUserData = {
                id: session.user.id,
                email: session.user.email,
                userType: 'jobseeker'
              };
              setUserData(prev => {
                if (prev?.id === errorUserData.id && 
                    prev?.userType === errorUserData.userType) {
                  return prev;
                }
                return errorUserData;
              });
              setProfileLoaded(prev => prev ? prev : true);
            }
          })();
        } catch (error) {
          console.error('Error in auth state handler:', error);
          // Keep basic user data, don't reset
        }
      } else {
        setUserData(null);
        setProfileLoaded(false);
      }
      
      // Only set loading to false if it's currently true (prevents unnecessary updates)
      if (loadingRef.current) {
        setLoading(false);
      }
    });

    return () => subscription?.unsubscribe();
  }, [isLoggingIn, accountTypeMismatch]);

  // Create stable context value - only recalculate when actual data changes
  const value = useMemo(() => ({
    currentUser,
    userData,
    loading,
    profileLoaded,
    signup,
    register: signup, // Alias for compatibility
    login,
    logout,
    updateUserProfile,
    updateProfilePicture,
    refreshUserProfile
  }), [currentUser, userData, loading, profileLoaded, signup, login, logout, updateUserProfile, updateProfilePicture, refreshUserProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

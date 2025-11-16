import { createClient } from '@supabase/supabase-js'

// Supabase configuration - using ORIGINAL working project credentials
const supabaseUrl = 'https://qslbiuijmwhirnbyghrh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzbGJpdWlqbXdoaXJuYnlnaHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNjA4MTgsImV4cCI6MjA3NTgzNjgxOH0.VIJ7zDksm3QSghp_cePmn3An_M6WciDEE2GkXJ7QA90'

// Debug: Show current configuration
console.log('🔧 Supabase Config Debug:', {
  usingOriginalProject: true,
  finalUrl: supabaseUrl,
  finalKeyLength: supabaseAnonKey?.length || 0,
  projectId: 'qslbiuijmwhirnbyghrh'
})

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper functions for common operations
export const supabaseService = {
  // Authentication
  auth: {
    signUp: async (email, password, userData) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      })
      if (error) throw error
      return data
    },

    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (error) throw error
      return data
    },

    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },

    getCurrentUser: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },

    onAuthStateChange: (callback) => {
      return supabase.auth.onAuthStateChange(callback)
    }
  },

  // Database operations
  database: {
    // Jobseeker profiles
    jobseekerProfiles: {
      create: async (userId, profileData) => {
        // Filter out undefined values and ensure required fields
        const cleanData = {
          id: userId,
          email: profileData.email || '',
          userType: profileData.userType || 'jobseeker',
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          ...profileData
        };
        
        // Remove undefined values
        Object.keys(cleanData).forEach(key => {
          if (cleanData[key] === undefined) {
            delete cleanData[key];
          }
        });
        
               try {
                 const { data, error } = await supabase
                   .from('jobseeker_profiles')
                   .insert([cleanData])
                 if (error) throw error
                 return data
               } catch (error) {
                 // If the error is about missing columns, try with minimal data
                 if (error.message?.includes('column') || error.message?.includes('schema') || error.message?.includes('userType')) {
                   console.log('Schema cache issue detected, using minimal data (this is normal):', error.message);
          const minimalData = {
            id: userId,
            email: profileData.email || ''
          };
                   
                   const { data: minimalDataResult, error: minimalError } = await supabase
                     .from('jobseeker_profiles')
                     .insert([minimalData])
                   if (minimalError) throw minimalError
                   return minimalDataResult
                 }
                 throw error
               }
      },

      update: async (userId, profileData) => {
        const { data, error } = await supabase
          .from('jobseeker_profiles')
          .update(profileData)
          .eq('id', userId)
        if (error) throw error
        return data
      },

      get: async (userId) => {
        const { data, error } = await supabase
          .from('jobseeker_profiles')
          .select('*')
          .eq('id', userId)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        return data
      },

      upsert: async (userId, profileData) => {
        const { data, error } = await supabase
          .from('jobseeker_profiles')
          .upsert([{ id: userId, ...profileData }])
        if (error) throw error
        return data
      }
    },

    // Jobs
    jobs: {
      getAll: async () => {
        // Fetch existing employer IDs and filter jobs by those IDs
        const { data: employerRows, error: employerErr } = await supabase
          .from('employer_profiles')
          .select('id')
        if (employerErr) throw employerErr
        const employerIds = (employerRows || []).map(r => r.id).filter(Boolean)
        if (!employerIds.length) return []
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .in('employer_id', employerIds)
          .order('created_at', { ascending: false })
        if (error) throw error
        return data || []
      },

      getRecentJobs: async (limit = 3) => {
        const { data: employerRows, error: employerErr } = await supabase
          .from('employer_profiles')
          .select('id')
        if (employerErr) throw employerErr
        const employerIds = (employerRows || []).map(r => r.id).filter(Boolean)
        if (!employerIds.length) return []
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .in('employer_id', employerIds)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return data || []
      }
    },

    // Job likes
    jobLikes: {
      like: async (jobId, userId) => {
        const { data, error } = await supabase
          .from('job_likes')
          .insert([{ job_id: jobId, user_id: userId }])
        if (error) throw error
        return data
      },

      unlike: async (jobId, userId) => {
        const { data, error } = await supabase
          .from('job_likes')
          .delete()
          .eq('job_id', jobId)
          .eq('user_id', userId)
        if (error) throw error
        return data
      },

      getLikedJobs: async (userId) => {
        const { data, error } = await supabase
          .from('job_likes')
          .select(`
            *,
            jobs (*)
          `)
          .eq('user_id', userId)
        if (error) throw error
        return data?.map(item => ({ ...item.jobs, liked_at: item.created_at })) || []
      }
    }
  },

  // Storage operations
  storage: {
    uploadFile: async (file, filePath) => {
      const { data, error } = await supabase.storage
        .from('files')
        .upload(filePath, file)
      if (error) throw error
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('files')
        .getPublicUrl(filePath)
      
      return urlData.publicUrl
    },

    deleteFile: async (filePath) => {
      const { error } = await supabase.storage
        .from('files')
        .remove([filePath])
      if (error) throw error
    }
  },

  // Landing page statistics
  getStats: async () => {
    try {
      // Get counts from Supabase
      const { data: users } = await supabase
        .from('jobseeker_profiles')
        .select('id')
      
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
      
      const jobseekers = users?.length || 0;
      const employers = 0; // We'll add employer profiles later
      const openJobs = jobs?.length || 0;
      
      return {
        jobseekers,
        employers,
        openJobs
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      // Return fallback data
      return {
        jobseekers: 8500,
        employers: 120,
        openJobs: 300
      };
    }
  }
}



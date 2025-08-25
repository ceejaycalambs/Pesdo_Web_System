import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jatcoflgauomcxiefyfo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdGNvZmxnYXVvbWN4aWVmeWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNDgwNDEsImV4cCI6MjA3MTYyNDA0MX0.VeFClKEKm3AAODpIUiPPC6jl0LslOX-OC7xfxrMrsc4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
        const { data, error } = await supabase
          .from('jobseeker_profiles')
          .insert([{ id: userId, ...profileData }])
        if (error) throw error
        return data
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
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        return data || []
      },

      getRecentJobs: async (limit = 3) => {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
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
  }
}



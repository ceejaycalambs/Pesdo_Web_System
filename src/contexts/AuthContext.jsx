import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseService } from '../supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sign up function
  async function signup(email, password, userType, additionalData = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            userType: userType,
            ...additionalData
          }
        }
      });
      
      if (error) throw error;
      
      // Create user profile in Supabase
      if (data.user) {
        const userProfile = {
          id: data.user.id,
          email: data.user.email,
          userType: userType,
          created_at: new Date().toISOString(),
          ...additionalData
        };
        
        await supabaseService.database.jobseekerProfiles.create(data.user.id, userProfile);
        
        // Update local state
        setUserData(userProfile);
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Login function
  async function login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // Fetch user data from Supabase
      if (data.user) {
        const userProfile = await supabaseService.database.jobseekerProfiles.get(data.user.id);
        if (userProfile) {
          setUserData(userProfile);
        }
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Logout function
  async function logout() {
    try {
      await supabase.auth.signOut();
      setUserData(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Update user profile
  async function updateUserProfile(updates) {
    try {
      if (currentUser) {
        await supabaseService.database.jobseekerProfiles.update(currentUser.id, updates);
        
        // Update local state
        setUserData(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      throw error;
    }
  }

  // Update user profile picture
  async function updateProfilePicture(photoURL) {
    try {
      if (currentUser) {
        await supabaseService.database.jobseekerProfiles.update(currentUser.id, { profile_picture_url: photoURL });
        
        // Update local state
        setUserData(prev => ({ ...prev, profile_picture_url: photoURL }));
      }
    } catch (error) {
      throw error;
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setCurrentUser(session?.user || null);
      
      if (session?.user) {
        try {
          // Fetch user data from Supabase
          const userProfile = await supabaseService.database.jobseekerProfiles.get(session.user.id);
          if (userProfile) {
            setUserData(userProfile);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const value = {
    currentUser,
    userData,
    loading,
    signup,
    login,
    logout,
    updateUserProfile,
    updateProfilePicture
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

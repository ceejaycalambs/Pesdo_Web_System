import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      const userProfile = {
        uid: user.uid,
        email: user.email,
        userType: userType,
        createdAt: new Date().toISOString(),
        ...additionalData
      };
      
      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      // Update local state
      setUserData(userProfile);
      
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Login function
  async function login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Fetch user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
      
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Logout function
  function logout() {
    setUserData(null);
    return signOut(auth);
  }

  // Update user profile
  async function updateUserProfile(updates) {
    try {
      if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), updates);
        
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
        await updateProfile(currentUser, { photoURL });
        await updateDoc(doc(db, 'users', currentUser.uid), { photoURL });
        
        // Update local state
        setUserData(prev => ({ ...prev, photoURL }));
      }
    } catch (error) {
      throw error;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
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

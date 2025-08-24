import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';

// Authentication services
export const firebaseAuth = {
  register: async (email, password, userData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Store additional user data in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        email: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return user;
    } catch (error) {
      throw error;
    }
  },

  login: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  },

  onAuthStateChange: (callback) => {
    return onAuthStateChanged(auth, callback);
  }
};

// Database services
export const firebaseDB = {
  // User management
  users: {
    get: async (userId) => {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    },

    update: async (userId, data) => {
      const docRef = doc(db, 'users', userId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    }
  },

  // Job management
  jobs: {
    getAll: async () => {
      const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    getRecentJobs: async (limitCount = 5) => {
      const q = query(
        collection(db, 'jobs'), 
        orderBy('createdAt', 'desc'), 
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },

    getById: async (jobId) => {
      const docRef = doc(db, 'jobs', jobId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    },

    create: async (jobData, userId) => {
      const docRef = await addDoc(collection(db, 'jobs'), {
        ...jobData,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    },

    update: async (jobId, jobData) => {
      const docRef = doc(db, 'jobs', jobId);
      await updateDoc(docRef, {
        ...jobData,
        updatedAt: serverTimestamp()
      });
    },

    delete: async (jobId) => {
      const docRef = doc(db, 'jobs', jobId);
      await deleteDoc(docRef);
    }
  },

  // Job likes
  jobLikes: {
    like: async (jobId, jobseekerId) => {
      const likeData = {
        jobId,
        jobseekerId,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'jobLikes'), likeData);
    },

    unlike: async (jobId, jobseekerId) => {
      const q = query(
        collection(db, 'jobLikes'),
        where('jobId', '==', jobId),
        where('jobseekerId', '==', jobseekerId)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.docs.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
    },

    getLikedJobs: async (jobseekerId) => {
      const q = query(
        collection(db, 'jobLikes'),
        where('jobseekerId', '==', jobseekerId)
      );
      const querySnapshot = await getDocs(q);
      const likedJobIds = querySnapshot.docs.map(doc => doc.data().jobId);
      
      if (likedJobIds.length === 0) return [];
      
      const jobs = [];
      for (const jobId of likedJobIds) {
        const job = await firebaseDB.jobs.getById(jobId);
        if (job) jobs.push(job);
      }
      return jobs;
    },

    isLiked: async (jobId, jobseekerId) => {
      const q = query(
        collection(db, 'jobLikes'),
        where('jobId', '==', jobId),
        where('jobseekerId', '==', jobseekerId)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    }
  },

  // Jobseeker profiles
  jobseekerProfiles: {
    get: async (userId) => {
      const docRef = doc(db, 'jobseekerProfiles', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    },

    create: async (userId, profileData) => {
      await setDoc(doc(db, 'jobseekerProfiles', userId), {
        ...profileData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    },

    update: async (userId, profileData) => {
      const docRef = doc(db, 'jobseekerProfiles', userId);
      await updateDoc(docRef, {
        ...profileData,
        updatedAt: serverTimestamp()
      });
    }
  }
};

// Storage services
export const firebaseStorage = {
  uploadFile: async (file, path) => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return getDownloadURL(snapshot.ref);
  },

  getDownloadURL: async (path) => {
    const storageRef = ref(storage, path);
    return getDownloadURL(storageRef);
  }
};

// Landing page statistics
export const getStats = async () => {
  try {
    // Get counts from Firestore
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const jobsSnapshot = await getDocs(collection(db, 'jobs'));
    
    const jobseekers = usersSnapshot.docs.filter(doc => doc.data().userType === 'jobseeker').length;
    const employers = usersSnapshot.docs.filter(doc => doc.data().userType === 'employer').length;
    const openJobs = jobsSnapshot.docs.length;
    
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
};

// Test database connection
export const testDatabaseConnection = async () => {
  try {
    // Test Firestore connection
    const testDoc = await addDoc(collection(db, 'test'), {
      message: 'Database connection test',
      timestamp: serverTimestamp()
    });
    
    // Clean up test document
    await deleteDoc(doc(db, 'test', testDoc.id));
    
    console.log('✅ Database connection successful!');
    return { success: true, message: 'Database connected successfully' };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return { success: false, message: error.message };
  }
};

// Initialize sample data
export const initializeSampleData = async () => {
  try {
    const sampleJobs = [
      {
        title: "Frontend Developer",
        company_name: "Tech Solutions Inc.",
        description: "We are looking for a skilled frontend developer to join our team. You will be responsible for building user-friendly web applications using modern technologies like React, JavaScript, and CSS.",
        requirements: "React, JavaScript, CSS, HTML, Git, Responsive Design, 2+ years experience",
        salary_range: "₱25,000 - ₱35,000",
        location: "Surigao City",
        job_type: "Full-time",
        createdBy: "admin"
      },
      {
        title: "Backend Developer",
        company_name: "Digital Innovations",
        description: "Backend developer position with focus on Node.js and databases. You will work on server-side logic, API development, and database management.",
        requirements: "Node.js, SQL, API Development, MongoDB, Express.js, 3+ years experience",
        salary_range: "₱30,000 - ₱40,000",
        location: "Surigao City",
        job_type: "Full-time",
        createdBy: "admin"
      },
      {
        title: "UI/UX Designer",
        company_name: "Creative Studios",
        description: "Creative designer for web and mobile applications. You will create beautiful and functional user interfaces that enhance user experience.",
        requirements: "Figma, Adobe Creative Suite, Prototyping, User Research, 1+ years experience",
        salary_range: "₱20,000 - ₱30,000",
        location: "Surigao City",
        job_type: "Full-time",
        createdBy: "admin"
      },
      {
        title: "Marketing Specialist",
        company_name: "Growth Marketing Co.",
        description: "Join our marketing team to help grow our digital presence and reach more customers through various marketing channels.",
        requirements: "Social Media Marketing, Content Creation, Analytics, SEO, 1+ years experience",
        salary_range: "₱18,000 - ₱25,000",
        location: "Surigao City",
        job_type: "Part-time",
        createdBy: "admin"
      },
      {
        title: "Customer Service Representative",
        company_name: "Service Excellence Inc.",
        description: "Provide excellent customer service and support to our clients through various communication channels.",
        requirements: "Communication Skills, Problem Solving, Customer Service Experience, 6+ months experience",
        salary_range: "₱15,000 - ₱20,000",
        location: "Surigao City",
        job_type: "Full-time",
        createdBy: "admin"
      },
      {
        title: "Data Entry Specialist",
        company_name: "Data Processing Solutions",
        description: "Accurate and efficient data entry specialist needed for processing various types of information.",
        requirements: "Typing Speed 40+ WPM, Attention to Detail, MS Office, 1+ years experience",
        salary_range: "₱12,000 - ₱18,000",
        location: "Surigao City",
        job_type: "Full-time",
        createdBy: "admin"
      }
    ];

    // Add sample jobs to database
    for (const job of sampleJobs) {
      await firebaseDB.jobs.create(job, 'admin');
    }

    console.log('✅ Sample data initialized successfully!');
    return { success: true, message: 'Sample data added successfully' };
  } catch (error) {
    console.error('❌ Error initializing sample data:', error);
    return { success: false, message: error.message };
  }
};

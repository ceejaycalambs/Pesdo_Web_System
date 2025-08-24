# Firebase Backend Setup Guide

This guide will help you set up Firebase for your PESDO Web App backend.

## Prerequisites

1. A Google account
2. Node.js and npm installed
3. Your React app ready

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "pesdo-web-app")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Register Your Web App

1. In your Firebase project console, click the web icon (</>) to add a web app
2. Enter your app nickname (e.g., "PESDO Web App")
3. Choose whether to set up Firebase Hosting (optional for now)
4. Click "Register app"
5. Copy the Firebase configuration object

## Step 3: Configure Firebase in Your App

1. Open `src/firebase.js`
2. Replace the placeholder configuration with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

## Step 4: Enable Authentication

1. In Firebase Console, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Email/Password" authentication:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"

## Step 5: Set Up Firestore Database

1. In Firebase Console, go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" for development (you can secure it later)
4. Select a location closest to your users
5. Click "Done"

## Step 6: Set Up Storage (Optional)

1. In Firebase Console, go to "Storage" in the left sidebar
2. Click "Get started"
3. Choose "Start in test mode" for development
4. Select a location
5. Click "Done"

## Step 7: Security Rules (Important!)

### Firestore Security Rules

Go to Firestore Database > Rules and update with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admins can read all users
    match /users/{userId} {
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'admin';
    }
    
    // Jobs are readable by all authenticated users
    match /jobs/{jobId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType in ['admin', 'employer'];
    }
    
    // Job likes
    match /jobLikes/{likeId} {
      allow read, write: if request.auth != null;
    }
    
    // Jobseeker profiles
    match /jobseekerProfiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'admin';
    }
  }
}
```

### Storage Security Rules

Go to Storage > Rules and update with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Step 8: Environment Variables (Recommended)

1. Create a `.env` file in your project root
2. Add your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

3. Update `src/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

## Step 9: Test Your Setup

1. Start your development server: `npm run dev`
2. Try to register a new user
3. Try to login with the registered user
4. Check Firebase Console to see if data is being created

## Troubleshooting

### Common Issues:

1. **"Firebase App named '[DEFAULT]' already exists"**
   - Make sure you're not initializing Firebase multiple times
   - Check that you're importing Firebase correctly

2. **"Permission denied" errors**
   - Check your Firestore security rules
   - Make sure authentication is working properly

3. **"Network error" or "Failed to fetch"**
   - Check your Firebase configuration
   - Ensure your project is properly set up

4. **Authentication not working**
   - Verify Email/Password authentication is enabled
   - Check that your Firebase config is correct

### Getting Help:

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Support](https://firebase.google.com/support)

## Next Steps

After setting up Firebase:

1. Test all authentication flows (register, login, logout)
2. Test CRUD operations for jobs and user profiles
3. Implement proper error handling
4. Add loading states and user feedback
5. Consider implementing offline support
6. Set up proper production security rules

## Security Best Practices

1. **Never expose your Firebase config in public repositories**
2. **Use environment variables for sensitive data**
3. **Implement proper security rules**
4. **Regularly review and update security rules**
5. **Monitor Firebase usage and costs**
6. **Backup your data regularly**

## Cost Optimization

1. **Monitor your Firebase usage**
2. **Set up billing alerts**
3. **Use Firebase's free tier efficiently**
4. **Consider implementing caching strategies**
5. **Optimize database queries**

Your Firebase backend is now ready to use! 🚀

// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB89SoEQDNdIa6JLauUmmkmF03F9HeKtSo",
  authDomain: "pesdo-web-app.firebaseapp.com",
  projectId: "pesdo-web-app",
  storageBucket: "pesdo-web-app.firebasestorage.app",
  messagingSenderId: "775633675326",
  appId: "1:775633675326:web:734650e895c6668f0b1d6f",
  measurementId: "G-ZYJ5MKTWNC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

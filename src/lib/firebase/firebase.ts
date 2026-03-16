import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCOH364P6aD3wqrD-FWkB0xcOGHEY76uLw",
  authDomain: "teamwave-8e9d6.firebaseapp.com",
  projectId: "teamwave-8e9d6",
  storageBucket: "teamwave-8e9d6.firebasestorage.app",
  messagingSenderId: "477370365427",
  appId: "1:477370365427:web:eeda1f134432aeb0eb0e86",
  measurementId: "G-NSQ5J32GY7"
};

// Prevent duplicate app initialization (important for Next.js hot reloads)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

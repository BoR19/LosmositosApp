import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Read Firebase configuration dynamically from environment variables (Vite & Next.js compatible)
const getEnvVar = (viteKey: string, nextKey: string, fallback: string = ''): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    return import.meta.env[viteKey];
  }
  if (typeof process !== 'undefined' && process.env && process.env[nextKey]) {
    return process.env[nextKey];
  }
  if (typeof process !== 'undefined' && process.env && process.env[viteKey]) {
    return process.env[viteKey];
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'AIzaSyAZDqVKKM7nBUKPpHw7L1FScbRwkmBmDN4'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'starry-serenity-d6tvw.firebaseapp.com'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'starry-serenity-d6tvw'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'starry-serenity-d6tvw.firebasestorage.app'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '459016782177'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID', '1:459016782177:web:2fcae64a678a538f048520'),
  firestoreDatabaseId: getEnvVar('VITE_FIREBASE_DATABASE_ID', 'NEXT_PUBLIC_FIREBASE_DATABASE_ID', 'ai-studio-elchuromosito-4e670c96-9906-4db5-9374-2de8c74be888'),
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance;
export const storage = getStorage(app);
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();
export default app;

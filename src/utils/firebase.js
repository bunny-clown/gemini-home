import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, GoogleAuthProvider, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000:web:000000000',
};

export const isNativePlatform = Capacitor.isNativePlatform();
export const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

let app, auth, db, googleProvider;

try {
  app = initializeApp(firebaseConfig);
  // On native (Capacitor/WKWebView), IndexedDB hangs — use localStorage from the start
  auth = isNativePlatform
    ? initializeAuth(app, { persistence: browserLocalPersistence })
    : getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch {
  console.warn('Firebase init skipped (demo mode)');
}

export { auth, db, googleProvider };

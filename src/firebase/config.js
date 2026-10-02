import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  getDoc as rawGetDoc,
  getDocs as rawGetDocs,
  setDoc as rawSetDoc,
  updateDoc as rawUpdateDoc,
  deleteDoc as rawDeleteDoc,
  onSnapshot as rawOnSnapshot,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Vite only inlines literal import.meta.env.X reads, so callers pass values, not key names.
const getEnv = (...vals) => {
  for (const val of vals) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
};

// Public web config (not secret); env vars still win when set.
const firebaseConfig = {
  apiKey: getEnv(import.meta.env.VITE_FIREBASE_API_KEY, import.meta.env.FIREBASE_API_KEY, import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'AIzaSyD7HsClWQCjdggvdEshUh2lfW31j6Vo9rM'),
  authDomain: getEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, import.meta.env.FIREBASE_AUTH_DOMAIN, import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 'story-swap-ca969.firebaseapp.com'),
  databaseURL: getEnv(import.meta.env.VITE_FIREBASE_DATABASE_URL, import.meta.env.FIREBASE_DATABASE_URL, import.meta.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, 'https://story-swap-ca969-default-rtdb.europe-west1.firebasedatabase.app'),
  projectId: getEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID, import.meta.env.FIREBASE_PROJECT_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'story-swap-ca969'),
  storageBucket: getEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, import.meta.env.FIREBASE_STORAGE_BUCKET, import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 'story-swap-ca969.firebasestorage.app'),
  messagingSenderId: getEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, import.meta.env.FIREBASE_MESSAGING_SENDER_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, '572510162032'),
  appId: getEnv(import.meta.env.VITE_FIREBASE_APP_ID, import.meta.env.FIREBASE_APP_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID, '1:572510162032:web:1454c49f6aa8bb4666f8b5'),
  measurementId: getEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, import.meta.env.FIREBASE_MEASUREMENT_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, 'G-5JRTMTEVM3'),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'your_api_key_here'
);

let app = null;
let db = null;
let auth = null;
let analytics = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      isSupported()
        .then((supported) => {
          if (supported) {
            analytics = getAnalytics(app);
          }
        })
        .catch(() => {});
    }
  } catch (error) {
    console.error('Failed to initialize Firebase SDK:', error);
  }
} else {
  console.info(
    'ℹ️ Firebase environment variables are not set. Story Swap is operating in real-time local sync mode (using BroadcastChannel). To connect to Cloud Firestore, configure .env.'
  );
}

// The anonymous uid only satisfies the Firestore rules (request.auth != null); it is not the participant identity.
// Never rejects, so the app keeps working under open rules if the Anonymous provider isn't enabled yet.
export const authReady = auth
  ? auth.authStateReady()
      .then(() => auth.currentUser || signInAnonymously(auth))
      .then(() => undefined)
      .catch((err) => console.warn('Firebase anonymous sign-in failed, continuing without auth:', err))
  : Promise.resolve();

export const getDoc = (...args) => authReady.then(() => rawGetDoc(...args));
export const getDocs = (...args) => authReady.then(() => rawGetDocs(...args));
export const setDoc = (...args) => authReady.then(() => rawSetDoc(...args));
export const updateDoc = (...args) => authReady.then(() => rawUpdateDoc(...args));
export const deleteDoc = (...args) => authReady.then(() => rawDeleteDoc(...args));

export function onSnapshot(...args) {
  let unsubscribe = null;
  let cancelled = false;
  authReady.then(() => {
    if (!cancelled) unsubscribe = rawOnSnapshot(...args);
  });
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export { app, db, auth, analytics };

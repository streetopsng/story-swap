import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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

const firebaseConfig = {
  apiKey: getEnv(import.meta.env.VITE_FIREBASE_API_KEY, import.meta.env.FIREBASE_API_KEY, import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: getEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, import.meta.env.FIREBASE_AUTH_DOMAIN, import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  databaseURL: getEnv(import.meta.env.VITE_FIREBASE_DATABASE_URL, import.meta.env.FIREBASE_DATABASE_URL, import.meta.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
  projectId: getEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID, import.meta.env.FIREBASE_PROJECT_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: getEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, import.meta.env.FIREBASE_STORAGE_BUCKET, import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: getEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, import.meta.env.FIREBASE_MESSAGING_SENDER_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: getEnv(import.meta.env.VITE_FIREBASE_APP_ID, import.meta.env.FIREBASE_APP_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: getEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, import.meta.env.FIREBASE_MEASUREMENT_ID, import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
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

export { app, db, auth, analytics };

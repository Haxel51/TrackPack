import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, setLogLevel } from 'firebase/firestore';

// Embedded Firebase client configuration with environment variable fallbacks
export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-4052460451-ae5db",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:615516479021:web:9d6a403297f382654de2a4",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCF5BcPjc0tPqK3N-F0-xL-puN6a643z8k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-4052460451-ae5db.firebaseapp.com",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-e8070696-e20a-452d-b72f-33b5cdae1d5c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-4052460451-ae5db.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "615516479021",
  measurementId: "",
  oAuthClientId: "615516479021-buqcp83rmtli1cugl7cdujq70qftju72.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// Filter internal diagnostic warnings
try {
  setLogLevel('error');
} catch {
  // Ignore in environments where setLogLevel is not supported
}

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with robust multi-tab local persistence and auto-recovery
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  // If already initialized or running in strict single-instance environment
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export default firebaseConfig;

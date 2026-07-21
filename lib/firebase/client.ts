import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isNewApp = !getApps().length;
export const app = isNewApp ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
// Falls back to long-polling on networks/proxies that block the default
// WebChannel streaming transport.
export const db = isNewApp
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// signInWithRedirect completes on the next page load — every useUser()
// instance would otherwise race to consume the one-time result, so it's
// cached here and shared across all callers.
let redirectResultPromise: ReturnType<typeof getRedirectResult> | null = null;
export function consumeGoogleRedirectResult() {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth);
  }
  return redirectResultPromise;
}

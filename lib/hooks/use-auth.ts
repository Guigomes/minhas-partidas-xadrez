'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, consumeGoogleRedirectResult } from '@/lib/firebase/client';

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
]);

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<unknown>(null);

  useEffect(() => {
    consumeGoogleRedirectResult().catch((err) => setRedirectError(err));

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading, redirectError };
}

export function useSignInWithGoogle() {
  return useMutation({
    // Popup is more reliable than a full-page redirect when the auth
    // domain (firebaseapp.com) differs from the app's own domain, since
    // some mobile browsers drop the pending-redirect state across that
    // cross-domain hop. Falls back to redirect only if the popup itself
    // can't open (blocked / unsupported webview).
    mutationFn: async () => {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code && POPUP_FALLBACK_CODES.has(code)) {
          await signInWithRedirect(auth, googleProvider);
          return null;
        }
        throw err;
      }
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await firebaseSignOut(auth);
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}

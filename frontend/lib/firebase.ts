"use client";

import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { useEffect, useState } from "react";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export function firebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

function app(): FirebaseApp | null {
  if (!firebaseConfigured()) {
    return null;
  }
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export function useFirebaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const enabled = firebaseConfigured();

  useEffect(() => {
    const firebaseApp = app();
    if (!firebaseApp) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(getAuth(firebaseApp), (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  async function signIn() {
    const firebaseApp = app();
    if (!firebaseApp) {
      return null;
    }
    const result = await signInWithPopup(getAuth(firebaseApp), new GoogleAuthProvider());
    setUser(result.user);
    return result.user;
  }

  async function signOutUser() {
    const firebaseApp = app();
    if (!firebaseApp) {
      return;
    }
    await signOut(getAuth(firebaseApp));
    setUser(null);
  }

  async function token() {
    return user ? user.getIdToken() : null;
  }

  return { enabled, user, loading, signIn, signOutUser, token };
}


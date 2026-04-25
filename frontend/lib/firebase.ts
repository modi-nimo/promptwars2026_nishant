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

import { getRuntimeConfig } from "./runtime-config";

function firebaseConfig() {
  const runtimeConfig = getRuntimeConfig().firebase ?? {};
  return {
    apiKey: runtimeConfig.apiKey ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: runtimeConfig.authDomain ?? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: runtimeConfig.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: runtimeConfig.appId ?? process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };
}

export function firebaseConfigured() {
  const config = firebaseConfig();
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.appId
  );
}

function app(): FirebaseApp | null {
  const config = firebaseConfig();
  if (!(config.apiKey && config.authDomain && config.projectId && config.appId)) {
    return null;
  }
  return getApps().length ? getApps()[0] : initializeApp(config);
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
      throw new Error("Firebase web config is missing");
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

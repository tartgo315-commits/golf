import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = '@gca_session_v1';

export type UserProfile = {
  heightCm: number;
  weightKg: number;
  dominantHand: 'left' | 'right';
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  ageGroup: 'junior' | 'adult' | 'senior';
};

export type Session = {
  email: string;
  provider: 'email' | 'google' | 'apple';
  profile?: UserProfile;
};

export function profileFilled(profile?: UserProfile): boolean {
  return Boolean(profile && profile.heightCm > 0 && profile.weightKg > 0);
}

type AuthContextValue = {
  hydrated: boolean;
  session: Session | null;
  profileComplete: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ complete: boolean }>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<{ complete: boolean }>;
  signInWithApple: () => Promise<{ complete: boolean }>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function readStoredSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

async function writeStoredSession(session: Session | null) {
  if (!session) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await readStoredSession();
      if (!cancelled) {
        setSession(s);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profileComplete = profileFilled(session?.profile);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const e = normalizeEmail(email);
    if (!e || password.length < 4) {
      throw new Error('Enter a valid email and password (4+ characters).');
    }
    const prev = await readStoredSession();
    if (prev && normalizeEmail(prev.email) === e) {
      setSession(prev);
      await writeStoredSession(prev);
      return { complete: profileFilled(prev.profile) };
    }
    const next: Session = { email: e, provider: 'email', profile: undefined };
    setSession(next);
    await writeStoredSession(next);
    return { complete: false };
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    const e = normalizeEmail(email);
    if (!e || password.length < 4) {
      throw new Error('Enter a valid email and password (4+ characters).');
    }
    const next: Session = { email: e, provider: 'email', profile: undefined };
    setSession(next);
    await writeStoredSession(next);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const next: Session = {
      email: 'golfer.google@example.com',
      provider: 'google',
      profile: undefined,
    };
    setSession(next);
    await writeStoredSession(next);
    return { complete: false };
  }, []);

  const signInWithApple = useCallback(async () => {
    const next: Session = {
      email: 'golfer.apple@icloud.com',
      provider: 'apple',
      profile: undefined,
    };
    setSession(next);
    await writeStoredSession(next);
    return { complete: false };
  }, []);

  const saveProfile = useCallback(async (profile: UserProfile) => {
    const prev = await readStoredSession();
    if (!prev) return;
    const next = { ...prev, profile };
    setSession(next);
    await writeStoredSession(next);
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    await writeStoredSession(null);
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      session,
      profileComplete,
      signInWithEmail,
      registerWithEmail,
      signInWithGoogle,
      signInWithApple,
      saveProfile,
      signOut,
    }),
    [
      hydrated,
      session,
      profileComplete,
      signInWithEmail,
      registerWithEmail,
      signInWithGoogle,
      signInWithApple,
      saveProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

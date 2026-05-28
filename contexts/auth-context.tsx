import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AUTH_GATE_BYPASSED } from '@/constants/auth-bypass';
import { E2E_MOCK_SESSION } from '@/constants/e2e-mock-session';
import { supabase } from '@/lib/supabase';

export type UserProfile = {
  heightCm: number;
  weightKg: number;
  dominantHand: 'left' | 'right';
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  ageGroup: 'junior' | 'adult' | 'senior';
};

export type Session = {
  email: string;
  provider: 'email';
  userId: string;
  nickname?: string;
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
  registerWithEmail: (email: string, password: string, nickname?: string) => Promise<void>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function profileKey(userId: string) {
  return `@gca_profile_v1:${userId}`;
}

async function readStoredProfile(userId: string): Promise<UserProfile | undefined> {
  const raw = await AsyncStorage.getItem(profileKey(userId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return undefined;
  }
}

async function writeStoredProfile(userId: string, profile: UserProfile | undefined) {
  if (!profile) {
    await AsyncStorage.removeItem(profileKey(userId));
    return;
  }
  await AsyncStorage.setItem(profileKey(userId), JSON.stringify(profile));
}

function sessionFromSupabase(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null,
  profile?: UserProfile,
): Session | null {
  if (!user || !user.id) return null;
  const email = (user.email ?? '').trim().toLowerCase();
  if (!email) return null;
  const nicknameRaw = user.user_metadata?.nickname;
  const nickname = typeof nicknameRaw === 'string' ? nicknameRaw : undefined;
  return {
    email,
    provider: 'email',
    userId: user.id,
    nickname,
    profile,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let alive = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (!alive) return;
      if (!u) {
        if (AUTH_GATE_BYPASSED) {
          setSession(E2E_MOCK_SESSION);
        } else {
          setSession(null);
        }
        setHydrated(true);
        return;
      }
      const p = await readStoredProfile(u.id);
      if (!alive) return;
      setSession(sessionFromSupabase(u, p));
      setHydrated(true);
    };

    void init();

    const sub = supabase.auth.onAuthStateChange(async (_event, s) => {
      const u = s?.user ?? null;
      if (!alive) return;
      if (!u) {
        setSession(null);
        return;
      }
      const p = await readStoredProfile(u.id);
      if (!alive) return;
      setSession(sessionFromSupabase(u, p));
    });

    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const profileComplete = profileFilled(session?.profile);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const e = normalizeEmail(email);
    if (!e) {
      throw new Error('请输入正确的邮箱');
    }
    if (password.length < 6) {
      throw new Error('密码至少 6 位');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
    if (error) throw error;
    const u = data.user ?? data.session?.user ?? null;
    if (!u) {
      setSession(null);
      return { complete: false };
    }
    const p = await readStoredProfile(u.id);
    const next = sessionFromSupabase(u, p);
    setSession(next);
    return { complete: profileFilled(next?.profile) };
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string, nickname?: string) => {
    const e = normalizeEmail(email);
    if (!e) {
      throw new Error('请输入正确的邮箱');
    }
    if (password.length < 6) {
      throw new Error('密码至少 6 位');
    }
    const { error } = await supabase.auth.signUp({
      email: e,
      password,
      options: nickname ? { data: { nickname } } : undefined,
    });
    if (error) throw error;
  }, []);

  const saveProfile = useCallback(async (profile: UserProfile) => {
    const userId = session?.userId;
    if (!userId) return;
    await writeStoredProfile(userId, profile);
    setSession((prev) => (prev ? { ...prev, profile } : prev));
  }, [session?.userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      session,
      profileComplete,
      signInWithEmail,
      registerWithEmail,
      saveProfile,
      signOut,
    }),
    [
      hydrated,
      session,
      profileComplete,
      signInWithEmail,
      registerWithEmail,
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

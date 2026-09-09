/**
 * CALLSHIELD AuthContext
 * Manages Supabase session, user, and profile state globally.
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { isLabEmail, isLabOtp, isLabPassword, LAB_EMAIL } from '../services/labAuth';

const LAB_USER = {
  id: '00000000-0000-4000-a000-000000000001',
  email: LAB_EMAIL,
  app_metadata: {},
  user_metadata: { full_name: 'Lab Tester' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
} as User;

function labProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: LAB_USER.id,
    username: 'lab',
    full_name: 'Lab Tester',
    email: LAB_EMAIL,
    phone: '+10000000000',
    avatar_color: '#00B4D8',
    persona_name: 'Alex',
    ghost_mode_enabled: true,
    plan: 'lab',
    created_at: now,
    updated_at: now,
  };
}

export interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_color: string;
  persona_name: string;
  ghost_mode_enabled: boolean;
  plan: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  resendOtp: (email: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInLabTester: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [labMode, setLabMode] = useState(false);

  // ── Fetch user profile from Supabase ──────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data as UserProfile);
      }
    } catch {}
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Session recovery on mount ──────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setIsLoading(false);
    };
    const t = setTimeout(finish, 4000);
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      finish();
    }).catch(() => {
      finish();
    }).finally(() => clearTimeout(t));
  }, []);

  // ── Auth state changes ─────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── App state: pause/resume token refresh ─────────────────────────────────
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  // ── Auth methods ───────────────────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          username: email.split('@')[0],
        },
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signInLabTester = useCallback(async (): Promise<{ error: string | null }> => {
    if (!__DEV__) return { error: 'Lab tester is only available in development builds.' };
    setLabMode(true);
    setUser(LAB_USER);
    setProfile(labProfile());
    setSession({
      access_token: 'lab-local',
      refresh_token: 'lab-local',
      expires_in: 86400,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      token_type: 'bearer',
      user: LAB_USER,
    } as Session);
    return { error: null };
  }, []);

  const verifyOtp = useCallback(async (
    email: string,
    token: string,
  ): Promise<{ error: string | null }> => {
    if (__DEV__ && isLabOtp(token)) {
      return signInLabTester();
    }
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'signup',
    });
    if (error) return { error: error.message };
    return { error: null };
  }, [signInLabTester]);

  const resendOtp = useCallback(async (
    email: string,
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signIn = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ error: string | null }> => {
    if (__DEV__ && isLabEmail(email) && isLabPassword(password)) {
      return signInLabTester();
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, [signInLabTester]);

  const signOut = useCallback(async () => {
    setLabMode(false);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (
    updates: Partial<UserProfile>,
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    if (labMode) {
      setProfile(prev => (prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : prev));
      return { error: null };
    }
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { error: error.message };
    await fetchProfile(user.id);
    return { error: null };
  }, [user, fetchProfile, labMode]);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      isLoading,
      isAuthenticated: !!session || labMode,
      signUp,
      verifyOtp,
      resendOtp,
      signIn,
      signInLabTester,
      signOut,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

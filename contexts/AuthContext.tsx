/**
 * CALLSHIELD AuthContext
 * Manages Supabase session, user, and profile state globally.
 *
 * All authentication goes through Supabase Auth. There is no offline,
 * fabricated, or hard-coded session anywhere in this module: a user is
 * authenticated if and only if Supabase issued a session.
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabaseClient';
import {
  normalizeEmail,
  isValidOtpFormat,
  OTP_CODE_LENGTH,
  DEV_TEST_EMAIL_VAR,
  DEV_TEST_PASSWORD_VAR,
} from '../services/authUtils';

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
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null; needsOtp: boolean }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  resendOtp: (email: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * __DEV__-only convenience: signs in with the real Supabase test account
   * configured via EXPO_PUBLIC_DEV_TEST_EMAIL / EXPO_PUBLIC_DEV_TEST_PASSWORD.
   * This is a genuine signInWithPassword against Supabase, never a fabricated
   * session. Unavailable in release builds and when the env vars are unset.
   */
  signInDevTester: () => Promise<{ error: string | null }>;
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

  // ── Ensure a profile row exists, without ever overwriting one ─────────────
  // Insert-only: a fresh row is created from the auth user_metadata on first
  // sign-in. Existing rows are NEVER updated here, so a profile the user
  // edited in the app (persona name, avatar, etc.) cannot be clobbered by a
  // later session refresh.
  const ensureProfile = useCallback(async (authed: User) => {
    const meta = authed.user_metadata ?? {};
    const row = {
      id: authed.id,
      email: authed.email ?? '',
      full_name: (meta.full_name as string) || '',
      phone: (meta.phone as string) || '',
      username: (meta.username as string) || (authed.email ?? '').split('@')[0],
      avatar_color: '#00B4D8',
      persona_name: 'Alex',
      ghost_mode_enabled: true,
      plan: 'free',
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('user_profiles')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    if (error) {
      console.warn('[auth] ensureProfile insert failed:', error.message);
    }
  }, []);

  const fetchProfile = useCallback(async (authed: User) => {
    try {
      await ensureProfile(authed);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authed.id)
        .single();
      if (error) {
        console.warn('[auth] fetchProfile failed:', error.message);
        return;
      }
      if (data) setProfile(data as UserProfile);
    } catch (e: any) {
      console.warn('[auth] fetchProfile threw:', e?.message ?? e);
    }
  }, [ensureProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user);
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
      if (s?.user) fetchProfile(s.user);
      finish();
    }).catch((e: any) => {
      console.warn('[auth] getSession failed:', e?.message ?? e);
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
          fetchProfile(s.user);
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
  ): Promise<{ error: string | null; needsOtp: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          username: normalizeEmail(email).split('@')[0],
        },
        // If the user taps the confirmation link instead of typing the OTP,
        // bring them back into the app so the code can be exchanged.
        emailRedirectTo: Linking.createURL('/'),
      },
    });
    if (error) return { error: error.message, needsOtp: true };
    if (data.session && data.user) await fetchProfile(data.user);
    return { error: null, needsOtp: !data.session };
  }, [fetchProfile]);

  const signInDevTester = useCallback(async (): Promise<{ error: string | null }> => {
    if (!__DEV__) {
      return { error: 'The dev test account is only available in development builds.' };
    }
    const email = (process.env[DEV_TEST_EMAIL_VAR] ?? '').trim();
    const password = (process.env[DEV_TEST_PASSWORD_VAR] ?? '').trim();
    if (!email || !password) {
      return {
        error:
          'Dev test account not configured. Set EXPO_PUBLIC_DEV_TEST_EMAIL and ' +
          'EXPO_PUBLIC_DEV_TEST_PASSWORD in your local .env (see .env.example), ' +
          'using a real test account you created via sign-up.',
      };
    }
    // Genuine Supabase password sign-in. No fabricated session.
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const verifyOtp = useCallback(async (
    email: string,
    token: string,
  ): Promise<{ error: string | null }> => {
    if (!isValidOtpFormat(token)) {
      return { error: `Enter the ${OTP_CODE_LENGTH}-digit code from your email.` };
    }
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: token.trim(),
      type: 'signup',
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const resendOtp = useCallback(async (
    email: string,
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signIn = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      console.warn('[auth] signOut failed:', e?.message ?? e);
    } finally {
      // Local auth state is always cleared, even if the server call failed.
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  const updateProfile = useCallback(async (
    updates: Partial<UserProfile>,
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { error: error.message };
    await fetchProfile(user);
    return { error: null };
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      isLoading,
      isAuthenticated: !!session,
      signUp,
      verifyOtp,
      resendOtp,
      signIn,
      signInDevTester,
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

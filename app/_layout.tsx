import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { BrandMark } from '../components/BrandMark';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Colors } from '../constants/theme';
import { router } from 'expo-router';
import { registerCallKitEvents, setupCallKit } from '../services/callKitService';
import { registerPushToken } from '../services/permissionsService';
import {
  onIncomingVoipCall,
  registerVoipPushToken,
  startVoipPushListener,
  unregisterVoipPushToken,
} from '../services/voipPush';
import { getAllContacts } from '../services/contactsService';
import { supabase } from '../services/supabaseClient';
import * as Linking from 'expo-linking';
import { assertEnv } from '../services/env';
import { classifyAuthDeepLink } from '../services/authUtils';
import { initSentry } from '../services/sentry';
import { initAnalytics, trackEvent } from '../services/analytics';
import { getConsentState } from '../services/consent';
import ConsentBanner from '../components/ConsentBanner';

// Fail fast at startup when required env vars are missing, instead of
// booting into a broken state (e.g. Supabase auth silently failing).
assertEnv();

// Crash reporting. Graceful no-op when EXPO_PUBLIC_SENTRY_DSN is unset.
initSentry();

// Privacy-safe analytics (feature usage only). No-op when opted out.
initAnalytics().catch(() => {});
trackEvent('app_open').catch(() => {});

async function handleAuthUrl(url: string | null) {
  const classified = classifyAuthDeepLink(url);
  if (classified.kind === 'none') return;
  if (classified.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(classified.code);
    if (error) {
      // Surfaced honestly: the link was bad/expired. The reset screen's save
      // will report the real failure instead of pretending it worked.
      console.warn('[auth] exchangeCodeForSession failed:', error.message);
    }
  }
  if (classified.kind === 'recovery') {
    router.push('/reset-password');
  }
  // 'session-code' links (e.g. email confirmation) need no navigation: the
  // exchanged session flows through onAuthStateChange and route gating.
}

// Initialize global services on app start
function AppInitializer() {
  useEffect(() => {
    Linking.getInitialURL().then(handleAuthUrl).catch(() => {});
    const linkSub = Linking.addEventListener('url', ({ url }) => { handleAuthUrl(url); });
    if (Platform.OS === 'web') {
      return () => linkSub.remove();
    }
    setupCallKit();
    getAllContacts().catch(() => {});
    registerPushToken().catch(() => {});
    // P1-4: PushKit VoIP registration + background incoming-call delivery.
    // The listener is always on (pushes can relaunch a terminated app);
    // token registration needs a signed-in user, so it follows auth state.
    startVoipPushListener();
    const unsubVoipCall = onIncomingVoipCall((call) => {
      router.push({
        pathname: '/incoming-call',
        params: {
          callUUID: call.callUUID,
          callerNumber: call.callerNumber,
          callerName: call.callerName,
        },
      });
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        registerVoipPushToken().catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        unregisterVoipPushToken().catch(() => {});
      }
    });
    // Also attempt registration for an already-restored session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) registerVoipPushToken().catch(() => {});
    });
    const unregister = registerCallKitEvents({
      onIncomingCall: (callUUID, callerNumber, callerName) => {
        router.push({
          pathname: '/incoming-call',
          params: { callUUID, callerNumber, callerName },
        });
      },
      onAnswerCall: (callUUID, callerNumber, callerName) => {
        router.replace({
          pathname: '/live-call',
          params: { callUUID, callerNumber, callerName, direction: 'inbound' },
        });
      },
      onStartCall: (callUUID, handle, contactIdentifier) => {
        router.push({
          pathname: '/live-call',
          params: {
            callUUID,
            callerNumber: handle,
            callerName: contactIdentifier || handle,
            direction: 'outbound',
          },
        });
      },
    });
    return () => {
      unregister();
      unsubVoipCall();
      authSub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);
  return null;
}

function AuthLoadingGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <View style={loadingStyles.logoWrap}>
          <BrandMark size={96} />
          <Text style={loadingStyles.logo}>ShieldCall AI</Text>
          <Text style={loadingStyles.sub}>Live Protect</Text>
        </View>
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        <Text style={loadingStyles.hint}>Restoring your protection...</Text>
      </View>
    );
  }
  return <>{children}</>;
}

// First-launch usage-data consent (P3-1, GDPR/CCPA). Analytics is opt-in:
// nothing is collected until the banner is answered, so the startup-cached
// analytics state is disabled until the user accepts.
function ConsentGate() {
  const [state, setState] = React.useState<'granted' | 'denied' | 'unasked' | null>(null);
  React.useEffect(() => {
    getConsentState().then(setState).catch(() => setState('unasked'));
  }, []);
  if (state !== 'unasked') return null;
  return <ConsentBanner onAnswered={() => setState(null)} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
        <AppProvider>
          <StatusBar style="light" />
          <AppInitializer />
          <ErrorBoundary>
            <AuthLoadingGate>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#060E1E' } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="live-call" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="protect" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="terms" />
                <Stack.Screen name="delete-data" />
                <Stack.Screen name="ghost-mode" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="call-detail" />
                <Stack.Screen name="incoming-call" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="lab-call" />
                <Stack.Screen name="reset-password" />
              </Stack>
            </AuthLoadingGate>
          </ErrorBoundary>
          <ConsentGate />
        </AppProvider>
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  logoWrap: { alignItems: 'center', gap: 6 },
  logo: {
    fontSize: 28, fontWeight: '900', color: Colors.primary,
    letterSpacing: 4,
  },
  sub: { fontSize: 12, color: Colors.textSecondary, letterSpacing: 1 },
  hint: { fontSize: 13, color: Colors.textMuted, marginTop: 16 },
});

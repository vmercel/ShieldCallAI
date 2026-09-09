import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Colors } from '../constants/theme';
import { router } from 'expo-router';
import { registerCallKitEvents, setupCallKit } from '../services/callKitService';
import { registerPushToken, requestAllPermissions } from '../services/permissionsService';
import { ensureContactsPermission, getAllContacts } from '../services/contactsService';

// Initialize global services on app start
function AppInitializer() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    setupCallKit();
    requestAllPermissions()
      .then(() => ensureContactsPermission())
      .then(ok => { if (ok) return getAllContacts(); })
      .catch(() => {});
    registerPushToken().catch(() => {});
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
    return () => unregister();
  }, []);
  return null;
}

function AuthLoadingGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <View style={loadingStyles.logoWrap}>
          <Text style={loadingStyles.logo}>ShieldCall</Text>
          <Text style={loadingStyles.sub}>Live Protect</Text>
        </View>
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
        <Text style={loadingStyles.hint}>Restoring your protection...</Text>
      </View>
    );
  }
  return <>{children}</>;
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
                <Stack.Screen name="ghost-mode" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="call-detail" />
                <Stack.Screen name="incoming-call" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="lab-call" />
              </Stack>
            </AuthLoadingGate>
          </ErrorBoundary>
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

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Colors } from '../constants/theme';

function AuthLoadingGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <View style={loadingStyles.logoWrap}>
          <Text style={loadingStyles.logo}>CALLSHIELD</Text>
          <Text style={loadingStyles.sub}>SENTINEL™ AI Active</Text>
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
        <AppProvider>
          <StatusBar style="light" />
          <ErrorBoundary>
            <AuthLoadingGate>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#060E1E' } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="live-call" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="ghost-mode" options={{ presentation: 'fullScreenModal' }} />
                <Stack.Screen name="call-detail" />
                <Stack.Screen name="incoming-call" options={{ presentation: 'fullScreenModal' }} />
              </Stack>
            </AuthLoadingGate>
          </ErrorBoundary>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

import React from 'react';

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

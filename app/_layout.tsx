import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../contexts/AppContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#060E1E' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="live-call" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="ghost-mode" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="call-detail" />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}

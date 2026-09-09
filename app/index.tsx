import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Colors } from '../constants/theme';

export default function IndexScreen() {
  // Auth still initializes (session restore, lab tester). It must not gate Protect.
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isOnboarded, isReady } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !isReady) return;

    const timer = setTimeout(() => {
      if (isOnboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isOnboarded, authLoading, isReady, router]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={Colors.primary} size="large" />
    </View>
  );
}

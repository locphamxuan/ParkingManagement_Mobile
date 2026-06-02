import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';

function AuthGate() {
  const { session, isLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    // No session → redirect away from protected route groups
    if (!session && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    // Has valid session but currently in login/register → route to correct landing
    if (session && inAuth) {
      const role = session.role;
      if (role === 'manager' || role === 'admin') {
        router.replace('/(tabs)/manager');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [session, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const { loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
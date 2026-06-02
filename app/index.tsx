import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/theme';

/**
 * Root entry index — acts as a role-aware splash gate.
 *
 * While the session is loading (e.g. token validation on app start),
 * this screen shows a dark splash with a spinner.
 *
 * Once resolved it redirects to the correct landing:
 *   - Manager / Admin  →  /(tabs)/manager
 *   - Regular user      →  /(tabs)
 *   - No session        →  /(auth)/login
 */
export default function Index() {
  const router = useRouter();
  const { session, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    const role = session.role;
    if (role === 'manager' || role === 'admin') {
      router.replace('/(tabs)/manager');
    } else {
      router.replace('/(tabs)');
    }
  }, [session, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // While redirect is being scheduled by the effect above,
  // keep showing a brief dark screen so the user doesn't
  // flash a login page before the redirect fires.
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
});
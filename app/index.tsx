import { Redirect } from 'expo-router';

/**
 * Root index — redirect immediately so the web entry URL `/`
 * has a valid route.  AuthGate in _layout.tsx then handles
 * session-aware navigation (login ↔ tabs).
 */
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}

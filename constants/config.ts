import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveDevHost(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  }
  let host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const parts = hostUri.split(':');
      if (parts[0]) host = parts[0];
    }
  } catch (error) {
    console.warn('Failed to parse hostUri, falling back to default:', error);
  }
  return host;
}

export function getMobileFrontendUrl(): string {
  if (!__DEV__) {
    return 'parkingmobile://reset-password';
  }
  if (Platform.OS === 'web') {
    return `http://${resolveDevHost()}:5173`;
  }
  return `http://${resolveDevHost()}:5173`;
}


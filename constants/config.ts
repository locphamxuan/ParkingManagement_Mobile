import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function getMobileFrontendUrl(): string {
  // Production URL config
  if (!__DEV__) {
    return 'parkingmobile://reset-password';
  }

  // Development / local environment (Expo Go/local emulator/real phone on local Wi-Fi)
  if (Platform.OS === 'web') {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${hostname}:5173`;
  }

  let host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const parts = hostUri.split(':');
      if (parts[0]) {
        host = parts[0];
      }
    }
  } catch (error) {
    console.warn('Failed to parse hostUri, falling back to default localhost/emulator IP:', error);
  }

  return `http://${host}:5173`;
}

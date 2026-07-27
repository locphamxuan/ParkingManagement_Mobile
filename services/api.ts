import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import Constants from 'expo-constants';

const getApiBase = () => {
  const configuredBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (configuredBase) return configuredBase;

  if (!__DEV__) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be configured for a production mobile build.');
  }

  if (Platform.OS === 'web') {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${hostname}:5000/api`;
  }

  // Development fallback only: Android emulator uses 10.0.2.2, iOS uses localhost.
  let host = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';

  // If running in development with Expo Go, get the actual machine IP dynamically from hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const parts = hostUri.split(':');
    if (parts[0]) {
      host = parts[0];
    }
  }

  return `http://${host}:5000/api`;
};

export const API_BASE = getApiBase();

const TOKEN_KEY = 'pbms_token';

/**
 * expo-secure-store does NOT support web.
 * On web we fall back to localStorage; on native we use SecureStore.
 */
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    return;
  }
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

/** Generic API response wrapper — all endpoints return `{ data: T }`. */
export interface ApiRes<T> {
  data?: T;
}

export class ApiError extends Error {
  status: number;
  errorCode?: string;
  payload?: unknown;

  constructor(message: string, status: number, errorCode?: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.payload = payload;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
        ? String((payload as { message?: unknown }).message)
        : `Request failed (${res.status})`;
    const errorCode =
      typeof payload === 'object' &&
      payload !== null &&
      'errorCode' in payload
        ? String((payload as { errorCode?: unknown }).errorCode)
        : undefined;
    throw new ApiError(message, res.status, errorCode, payload);
  }

  return payload as T;
}

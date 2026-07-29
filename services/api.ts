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

export const isWeb = Platform.OS === 'web';

/**
 * Token persistence is NATIVE-ONLY.
 *
 * expo-secure-store does not support web, and the old localStorage fallback put
 * a raw 7-day JWT somewhere any XSS payload could read. On web the session is
 * the backend's httpOnly `pbms_token` cookie instead, which JavaScript cannot
 * read and which every request below sends via `credentials: 'include'`.
 *
 * These are therefore deliberate no-ops on web — never reintroduce a browser
 * storage write here.
 */
export async function getToken(): Promise<string | null> {
  if (isWeb) return null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (isWeb) return;
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
  timeoutMs?: number;
  retries?: number;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 25000, retries = method === 'GET' ? 1 : 0 } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token && !isWeb) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        signal: controller.signal,
        ...(isWeb ? { credentials: 'include' as const } : {}),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timer);

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
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
      if (attempt <= retries && (isAbort || !(err instanceof ApiError))) {
        // Wait 1.5s and retry (server might be waking up from Render cold start)
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      if (isAbort) {
        throw new ApiError('Server response timed out. The server may be waking up, please try again.', 504, 'GATEWAY_TIMEOUT');
      }
      throw err;
    }
  }
}

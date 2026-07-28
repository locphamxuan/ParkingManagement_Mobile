/**
 * @jest-environment jsdom
 *
 * On web the raw JWT must never touch browser storage — the httpOnly cookie is
 * the session. On native SecureStore behaviour must be untouched.
 */
// Set before importing services/api so getApiBase does not probe window.location.
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:5000/api';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({ expoConfig: { hostUri: 'localhost:8081' } }));

import * as SecureStore from 'expo-secure-store';
import { getToken, setToken, apiRequest, isWeb } from '@/services/api';

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('web token storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    }) as unknown as typeof fetch;
  });

  it('reports the web platform', () => {
    expect(isWeb).toBe(true);
  });

  it('setToken writes nothing to localStorage', async () => {
    await setToken('a.real.jwt');

    expect(window.localStorage.getItem('pbms_token')).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('getToken never returns a token from browser storage', async () => {
    window.localStorage.setItem('pbms_token', 'leftover.jwt.from.old.build');

    await expect(getToken()).resolves.toBeNull();
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('clearing the token does not touch SecureStore on web', async () => {
    await setToken(null);
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('sends credentials and no Authorization header', async () => {
    await apiRequest('/users/auth/me', { token: 'a.real.jwt' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(init.headers.Authorization).toBeUndefined();
  });
});

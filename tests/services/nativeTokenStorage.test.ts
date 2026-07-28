/** Native behaviour must be unchanged: SecureStore + Bearer, no cookie. */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({ expoConfig: { hostUri: '192.168.1.5:8081' } }));

import * as SecureStore from 'expo-secure-store';
import { getToken, setToken, apiRequest, isWeb } from '@/services/api';

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('native token storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    }) as unknown as typeof fetch;
  });

  it('reports the native platform', () => {
    expect(isWeb).toBe(false);
  });

  it('stores the token in SecureStore', async () => {
    await setToken('a.real.jwt');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('pbms_token', 'a.real.jwt');
  });

  it('reads the token from SecureStore', async () => {
    secureStore.getItemAsync.mockResolvedValueOnce('a.real.jwt');
    await expect(getToken()).resolves.toBe('a.real.jwt');
  });

  it('deletes the token from SecureStore', async () => {
    await setToken(null);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('pbms_token');
  });

  it('sends the Bearer header and no credentials', async () => {
    await apiRequest('/users/auth/me', { token: 'a.real.jwt' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer a.real.jwt');
    expect(init.credentials).toBeUndefined();
  });
});

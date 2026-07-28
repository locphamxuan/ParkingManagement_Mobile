import { create } from 'zustand';
import { setToken, getToken, isWeb } from '../services/api';
import {
  login as apiLogin,
  requestRegistration as apiRequestRegistration,
  verifyRegistration as apiVerifyRegistration,
  logout as apiLogout,
  getMe,
  mapUser,
} from '../services/auth';
import type { RegistrationInput } from '../services/auth';
import type { AuthSession } from '../types';

interface AuthState {
  session: AuthSession | null;
  pendingRegistration: RegistrationInput | null;
  isLoading: boolean;
  // Actions
  login: (email: string, password: string) => Promise<void>;
  requestRegistration: (fullName: string, email: string, password: string, phone?: string) => Promise<void>;
  verifyRegistration: (otp: string) => Promise<void>;
  resendRegistrationCode: () => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateProfile: (data: Partial<Pick<AuthSession, 'displayName' | 'phone' | 'licensePlates'>>) => void;
}

// On web the raw JWT must never be retained — the httpOnly cookie is the
// session. Keep a non-secret marker so `session.token` stays truthy for the
// "is someone signed in" checks without holding a usable credential.
const WEB_SESSION_MARKER = 'cookie-session';
const sessionForPlatform = (session: AuthSession): AuthSession =>
  (isWeb ? { ...session, token: WEB_SESSION_MARKER } : session);

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  pendingRegistration: null,
  isLoading: true,

  login: async (email, password) => {
    const session = await apiLogin(email, password);
    if (session.role !== 'user') {
      await setToken(null);
      throw new Error(
        'The PBMS mobile app is for customer accounts. Please use the web portal for admin, manager, or staff access.',
      );
    }
    await setToken(session.token);
    set({ session: sessionForPlatform(session) });
  },

  requestRegistration: async (fullName, email, password, phone) => {
    const registration: RegistrationInput = { fullName, email, password, phone };
    await apiRequestRegistration(registration);
    set({ pendingRegistration: registration });
  },

  verifyRegistration: async (otp) => {
    const registration = get().pendingRegistration;
    if (!registration) {
      throw new Error('Registration details are missing. Please start registration again.');
    }

    // pendingRegistration lives only in this in-memory store (no `persist`
    // middleware), so the password never touches device storage either.
    const session = await apiVerifyRegistration(registration.email, otp, registration.password);
    await setToken(session.token);
    set({ session: sessionForPlatform(session), pendingRegistration: null });
  },

  resendRegistrationCode: async () => {
    const registration = get().pendingRegistration;
    if (!registration) {
      throw new Error('Registration details are missing. Please start registration again.');
    }

    await apiRequestRegistration(registration);
  },

  logout: async () => {
    // Revoke server-side (tokenVersion bump + cookie clear) before dropping
    // local state, so a copied token cannot outlive the logout.
    try {
      await apiLogout(isWeb ? null : await getToken());
    } catch {
      // Already-invalid session: clearing local state below is still correct.
    }
    await setToken(null);
    set({ session: null, pendingRegistration: null });
  },

  loadSession: async () => {
    try {
      // Native reads its Bearer token from SecureStore; web has none to read
      // and lets the httpOnly cookie authenticate the /me call.
      const token = await getToken();
      if (!token && !isWeb) {
        set({ isLoading: false });
        return;
      }
      const user = await getMe(token);
      const session = sessionForPlatform(mapUser(user, token ?? WEB_SESSION_MARKER));
      if (session.role !== 'user') {
        await setToken(null);
        set({ session: null, isLoading: false });
        return;
      }
      set({ session, isLoading: false });
    } catch {
      await setToken(null);
      set({ session: null, isLoading: false });
    }
  },

  updateProfile: (data) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, ...data } });
  },
}));

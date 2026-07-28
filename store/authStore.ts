import { create } from 'zustand';
import { setToken, getToken } from '../services/api';
import {
  login as apiLogin,
  requestRegistration as apiRequestRegistration,
  verifyRegistration as apiVerifyRegistration,
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
    set({ session });
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

    const session = await apiVerifyRegistration(registration.email, otp);
    await setToken(session.token);
    set({ session, pendingRegistration: null });
  },

  resendRegistrationCode: async () => {
    const registration = get().pendingRegistration;
    if (!registration) {
      throw new Error('Registration details are missing. Please start registration again.');
    }

    await apiRequestRegistration(registration);
  },

  logout: async () => {
    await setToken(null);
    set({ session: null, pendingRegistration: null });
  },

  loadSession: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // Validate token by calling /me
      const user = await getMe(token);
      const session: AuthSession = mapUser(user, token);
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

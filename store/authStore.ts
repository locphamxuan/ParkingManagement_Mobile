import { create } from 'zustand';
import { setToken, getToken } from '../services/api';
import { login as apiLogin, register as apiRegister } from '../services/auth';
import type { AuthSession, LicensePlate } from '../types';

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  updateProfile: (data: Partial<Pick<AuthSession, 'displayName' | 'phone' | 'licensePlates'>>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isLoading: true,

  login: async (email, password) => {
    const session = await apiLogin(email, password);
    await setToken(session.token);
    set({ session });
  },

  register: async (fullName, email, password, phone) => {
    const session = await apiRegister(fullName, email, password, phone);
    await setToken(session.token);
    set({ session });
  },

  logout: async () => {
    await setToken(null);
    set({ session: null });
  },

  loadSession: async () => {
    try {
      const token = await getToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      // Validate token by calling /me
      const { getMe } = await import('../services/auth');
      const user = await getMe(token);
      const session: AuthSession = {
        token,
        userId: String(user._id),
        role: user.role,
        email: user.email,
        displayName: user.fullName,
        phone: user.phone ?? '',
        licensePlates: (user.licensePlates ?? [])
          .map((p: any): LicensePlate => ({
            _id: p._id,
            plateNumber: p.plateNumber ?? '',
            vehicleType: (p.vehicleType === 'motorcycle' ? 'motorcycle' : 'car') as 'car' | 'motorcycle',
            isDefault: p.isDefault ?? false,
            qrCode: p.qrCode,
          }))
          .filter((p: LicensePlate) => Boolean(p.plateNumber)),
      };
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

import { apiRequest } from './api';
import type { AuthSession, LicensePlate } from '../types';

interface ApiUser {
  _id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager' | 'staff' | 'user';
  phone?: string;
  licensePlates?: Array<{
    _id?: string;
    plateNumber?: string;
    vehicleType?: string;
    isDefault?: boolean;
  }>;
}

function mapUser(user: ApiUser, token: string): AuthSession {
  const licensePlates: LicensePlate[] = (user.licensePlates ?? [])
    .map((p) => ({
      _id: p._id,
      plateNumber: p.plateNumber ?? '',
      vehicleType: (p.vehicleType === 'motorcycle' ? 'motorcycle' : 'car') as 'car' | 'motorcycle',
      isDefault: p.isDefault ?? false,
    }))
    .filter((p) => Boolean(p.plateNumber));

  return {
    token,
    userId: String(user._id),
    role: user.role,
    email: user.email,
    displayName: user.fullName,
    phone: user.phone ?? '',
    licensePlates,
  };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const res = await apiRequest<{ data?: { token?: string; user?: ApiUser } }>(
    '/users/auth/login',
    { method: 'POST', body: { email, password } },
  );
  const token = res?.data?.token;
  const user = res?.data?.user;
  if (!token || !user) throw new Error('Invalid login response');
  return mapUser(user, token);
}

export async function register(
  fullName: string,
  email: string,
  password: string,
  phone?: string,
): Promise<AuthSession> {
  const res = await apiRequest<{ data?: { token?: string; user?: ApiUser } }>(
    '/users/auth/register',
    { method: 'POST', body: { fullName, email, password, phone } },
  );
  const token = res?.data?.token;
  const user = res?.data?.user;
  if (!token || !user) throw new Error('Invalid register response');
  return mapUser(user, token);
}

export async function getMe(token: string): Promise<ApiUser> {
  const res = await apiRequest<{ data?: { user?: ApiUser } }>(
    '/users/auth/me',
    { token },
  );
  const user = res?.data?.user;
  if (!user) throw new Error('Unable to load user info');
  return user;
}

export async function forgotPassword(email: string): Promise<void> {
  await apiRequest('/users/auth/forgot-password', {
    method: 'POST',
    body: { email, clientType: 'mobile' },
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiRequest('/users/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  });
}

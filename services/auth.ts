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
    qrCode?: string;
  }>;
}

export interface RegistrationInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export function mapUser(user: ApiUser, token: string): AuthSession {
  const licensePlates: LicensePlate[] = (user.licensePlates ?? [])
    .map((p) => ({
      _id: p._id,
      plateNumber: p.plateNumber ?? '',
      vehicleType: (p.vehicleType ?? 'car') as LicensePlate['vehicleType'],
      isDefault: p.isDefault ?? false,
      qrCode: p.qrCode,
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

/**
 * Step 1 — request the emailed OTP. The password is deliberately NOT sent: the
 * backend stores only an OTP hash plus non-secret metadata at this point.
 */
export async function requestRegistration(input: RegistrationInput): Promise<void> {
  const { password: _password, ...withoutPassword } = input;
  await apiRequest('/users/auth/register-request', {
    method: 'POST',
    body: withoutPassword,
  });
}

/** Step 2 — the password travels only here, with the verified OTP. */
export async function verifyRegistration(
  email: string,
  otp: string,
  password: string,
): Promise<AuthSession> {
  const res = await apiRequest<{ data?: { token?: string; user?: ApiUser } }>(
    '/users/auth/register-verify',
    { method: 'POST', body: { email, otp, password } },
  );
  const token = res?.data?.token;
  const user = res?.data?.user;
  if (!token || !user) throw new Error('Invalid registration verification response');
  return mapUser(user, token);
}

/** On web the token is undefined — the httpOnly cookie authenticates instead. */
export async function getMe(token?: string | null): Promise<ApiUser> {
  const res = await apiRequest<{ data?: { user?: ApiUser } }>(
    '/users/auth/me',
    { token },
  );
  const user = res?.data?.user;
  if (!user) throw new Error('Unable to load user info');
  return user;
}

/**
 * Revokes the session server-side (bumps tokenVersion) and clears the web
 * cookie. Native passes its Bearer token; web relies on the cookie.
 */
export async function logout(token?: string | null): Promise<void> {
  await apiRequest('/users/auth/logout', { method: 'POST', token });
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

export async function requestPasswordResetSms(phone: string): Promise<void> {
  await apiRequest('/users/auth/forgot-password-sms', {
    method: 'POST',
    body: { phone },
  });
}

export async function resetPasswordSms(phone: string, otp: string, newPassword: string): Promise<void> {
  await apiRequest('/users/auth/reset-password-sms', {
    method: 'POST',
    body: { phone, otp, newPassword },
  });
}

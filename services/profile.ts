import { apiRequest } from './api';

export async function updateProfile(
  token: string,
  data: { fullName?: string; phone?: string },
): Promise<void> {
  await apiRequest('/users/profile', { method: 'PUT', body: data, token });
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiRequest('/users/profile/password', {
    method: 'PUT',
    body: { currentPassword, newPassword },
    token,
  });
}

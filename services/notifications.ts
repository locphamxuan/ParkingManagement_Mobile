import { apiRequest, type ApiRes } from './api';
import type { Notification } from '../types';

export async function listNotifications(
  token: string
): Promise<{ items: Notification[]; unread: number }> {
  const res = await apiRequest<ApiRes<{ items: Notification[]; unread: number }>>(
    '/users/notifications',
    { token }
  );
  return {
    items: res?.data?.items ?? [],
    unread: res?.data?.unread ?? 0,
  };
}

export async function markNotificationRead(
  token: string,
  id: string
): Promise<Notification> {
  const res = await apiRequest<ApiRes<Notification>>(
    `/users/notifications/${id}/read`,
    {
      method: 'PATCH',
      token,
    }
  );
  if (!res?.data) throw new Error('Failed to mark notification as read');
  return res.data;
}

export async function markAllNotificationsRead(
  token: string
): Promise<{ ok: boolean }> {
  const res = await apiRequest<ApiRes<{ ok: boolean }>>(
    '/users/notifications/read-all',
    {
      method: 'PATCH',
      token,
    }
  );
  return res?.data ?? { ok: false };
}

import { apiRequest } from './api';
import type { LongTermPackage, LongTermSubscription } from '../types';

interface ApiRes<T> {
  data?: T;
}

/** List long-term packages. If buildingId is omitted, returns all active packages across all buildings. */
export async function listPackages(token: string, buildingId?: string): Promise<LongTermPackage[]> {
  const query = buildingId ? `?buildingId=${encodeURIComponent(buildingId)}` : '';
  const res = await apiRequest<ApiRes<{ packages?: LongTermPackage[]; items?: LongTermPackage[] }>>(
    `/users/long-term/packages${query}`,
    { token },
  );
  return res?.data?.packages ?? res?.data?.items ?? [];
}

export async function listSubscriptions(token: string): Promise<LongTermSubscription[]> {
  const res = await apiRequest<ApiRes<{ subscriptions?: LongTermSubscription[] }>>(
    '/users/long-term/subscriptions',
    { token },
  );
  return res?.data?.subscriptions ?? [];
}

export async function subscribe(
  token: string,
  packageId: string,
  plateNumber: string,
  buildingId: string,
): Promise<LongTermSubscription> {
  const res = await apiRequest<ApiRes<{ subscription?: LongTermSubscription }>>(
    '/users/long-term/subscriptions',
    {
      method: 'POST',
      body: { packageId, plateNumber, buildingId },
      token,
    },
  );
  if (!res?.data?.subscription) throw new Error('Subscribe failed');
  return res.data.subscription;
}

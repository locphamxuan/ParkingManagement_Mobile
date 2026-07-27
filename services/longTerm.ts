import { apiRequest, type ApiRes } from './api';
import type { LongTermPackage, LongTermSubscription } from '../types';

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
  const res = await apiRequest<ApiRes<{ items?: LongTermSubscription[]; subscriptions?: LongTermSubscription[] }>>(
    '/users/long-term/subscriptions',
    { token },
  );
  return res?.data?.items ?? res?.data?.subscriptions ?? [];
}

export async function subscribe(
  token: string,
  packageId: string,
  plateNumber: string,
  buildingId: string,
  slotId?: string,
  startDate?: string,
): Promise<LongTermSubscription> {
  const res = await apiRequest<ApiRes<{ subscription?: LongTermSubscription }>>(
    '/users/long-term/subscriptions',
    {
      method: 'POST',
      body: { packageId, plateNumber, buildingId, slotId, startDate },
      token,
    },
  );
  if (!res?.data?.subscription) throw new Error('Subscribe failed');
  return res.data.subscription;
}

/** BE trả kèm refundAmount/refundPercent (snapshot theo ReservationPolicy lúc hủy). */
export interface CancelSubscriptionResult {
  subscription?: LongTermSubscription;
  refundAmount?: number;
  refundPercent?: number;
}

export async function cancelSubscription(
  token: string,
  id: string,
  cancelReason: string = 'no_longer_needed',
  cancelNote: string = ''
): Promise<CancelSubscriptionResult> {
  const res = await apiRequest<ApiRes<CancelSubscriptionResult>>(
    `/users/long-term/subscriptions/${id}/cancel`,
    {
      method: 'POST',
      body: { cancelReason, cancelNote },
      token,
    },
  );
  return res?.data ?? {};
}

export interface RefundPreview {
  refundPercent: number;
  refundAmount: number;
  packagePrice: number;
}

/** Preview refund %/amount BEFORE the user confirms cancellation — same calc BE uses on actual cancel. */
export async function getRefundPreview(token: string, id: string): Promise<RefundPreview | null> {
  const res = await apiRequest<ApiRes<RefundPreview>>(
    `/users/long-term/subscriptions/${id}/refund-preview`,
    { token },
  );
  return res?.data ?? null;
}

/** BE endpoint có thật, FE web đã dùng (LongTermSubscriptionsPage); Mobile gọi qua `usePackageRenewal`. */
export async function renewSubscription(
  token: string,
  id: string
): Promise<LongTermSubscription> {
  const res = await apiRequest<ApiRes<{ subscription?: LongTermSubscription }>>(
    `/users/long-term/subscriptions/${id}/renew`,
    {
      method: 'POST',
      token,
    },
  );
  if (!res?.data?.subscription) throw new Error('Renew subscription failed');
  return res.data.subscription;
}

import { apiRequest } from './api';
import type { WalletInfo, WalletTransaction, TopupResult } from '../types';

export async function getWallet(token: string): Promise<WalletInfo> {
  const res = await apiRequest<{ data?: { walletBalance?: number } }>(
    '/users/wallet',
    { token },
  );
  return { balance: res?.data?.walletBalance ?? 0 };
}

/**
 * Khởi tạo nạp ví qua PayOS.
 * Trả về checkoutUrl + qrCode để user thanh toán.
 * Số dư chỉ được cộng sau khi PayOS webhook xác nhận.
 */
export async function topup(token: string, amount: number): Promise<TopupResult> {
  const res = await apiRequest<{ data?: TopupResult }>(
    '/users/wallet/topup',
    { method: 'POST', body: { amount }, token },
  );
  if (!res?.data?.checkoutUrl) throw new Error('Không nhận được link thanh toán từ PayOS');
  return res.data;
}

export async function listTransactions(token: string): Promise<WalletTransaction[]> {
  const res = await apiRequest<{
    data?: { items?: WalletTransaction[] };
  }>('/users/wallet/transactions', { token });
  return res?.data?.items ?? [];
}

export interface VerifyTopupResult {
  status: 'success' | 'pending' | 'processing' | 'cancelled' | 'expired' | string;
  credited: boolean;
  balance: number;
}

/**
 * Reconcile a top-up with PayOS — fallback for when the webhook did not arrive.
 * If PayOS reports the order as PAID, the wallet is credited and `status` is 'success'.
 */
export async function verifyTopup(token: string, orderCode: number): Promise<VerifyTopupResult> {
  const res = await apiRequest<{ data?: VerifyTopupResult }>(
    `/users/wallet/topup/${orderCode}/status`,
    { token },
  );
  return res?.data ?? { status: 'pending', credited: false, balance: 0 };
}

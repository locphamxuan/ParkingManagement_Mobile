import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_TOPUP_PREFIX = 'pbms_pending_topup:';

function storageKey(userId: string): string {
  return `${PENDING_TOPUP_PREFIX}${userId}`;
}

export function parsePendingOrderCode(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isTerminalTopupStatus(status: string): boolean {
  return status === 'success' || status === 'cancelled' || status === 'expired';
}

export async function savePendingTopupOrder(
  userId: string,
  orderCode: number,
): Promise<void> {
  if (!userId || !Number.isSafeInteger(orderCode) || orderCode <= 0) {
    throw new Error('A valid user and PayOS order code are required.');
  }
  await AsyncStorage.setItem(storageKey(userId), String(orderCode));
}

export async function getPendingTopupOrder(userId: string): Promise<number | null> {
  if (!userId) return null;
  const key = storageKey(userId);
  const raw = await AsyncStorage.getItem(key);
  const orderCode = parsePendingOrderCode(raw);
  if (raw !== null && orderCode === null) await AsyncStorage.removeItem(key);
  return orderCode;
}

export async function clearPendingTopupOrder(userId: string): Promise<void> {
  if (!userId) return;
  await AsyncStorage.removeItem(storageKey(userId));
}

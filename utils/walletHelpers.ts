import type { WalletTransaction } from '../types';

export { fmtMoney } from './money';

export function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function txVariant(type: WalletTransaction['type']) {
  if (type === 'topup' || type === 'credit') return 'success';
  if (type === 'refund') return 'info';
  return 'error';
}

export function txSign(type: WalletTransaction['type']) {
  return type === 'topup' || type === 'refund' || type === 'credit' ? '+' : '-';
}

export function txLabel(type: WalletTransaction['type']) {
  if (type === 'topup' || type === 'credit') return 'Top-up';
  if (type === 'debit') return 'Payment';
  if (type === 'refund') return 'Refund';
  return type;
}

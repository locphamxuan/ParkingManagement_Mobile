import type { Reservation } from '../types';
import type { SlotItem } from '../services/floors';

// ─── Format helpers ─────────────────────────────────────────────────────────

export function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const CANCELLED_STATUSES: Reservation['status'][] = ['cancelled', 'expired'];

export function isCancelled(status: Reservation['status']) {
  return CANCELLED_STATUSES.includes(status);
}

export function statusVariant(status: Reservation['status']) {
  return isCancelled(status) ? 'error' : 'info';
}

export function statusLabel(status: Reservation['status']) {
  return isCancelled(status) ? 'Cancelled' : 'Booked';
}

export function fmtVND(amount: number) {
  return amount.toLocaleString('en-US') + ' VND';
}

// Chia slot thành 2 hàng đối xứng cho sơ đồ bãi (T1/chẵn ở trên, T2/lẻ ở dưới).
export function splitSlotsSymmetrically(allSlots: SlotItem[]) {
  const cars: SlotItem[] = [];
  const motos: SlotItem[] = [];

  allSlots.forEach((s) => {
    const code = s.code.toUpperCase();
    const vtName = s.vehicleType?.name?.toLowerCase() || '';
    if (code.includes('MOTO') || code.includes('SMW') || code.includes('SMR') || code.startsWith('M') || vtName.includes('moto')) {
      motos.push(s);
    } else {
      cars.push(s);
    }
  });

  if (cars.length > 0 && motos.length > 0) {
    return { topRowSlots: cars, bottomRowSlots: motos };
  }

  const half = Math.ceil(allSlots.length / 2);
  return {
    topRowSlots: allSlots.slice(0, half),
    bottomRowSlots: allSlots.slice(half),
  };
}

// Format Date → wizard string "YYYY-MM-DD HH:MM"
export function toWizardStr(date: Date): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const t = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${d} ${t}`;
}

// ─── Wizard types ───────────────────────────────────────────────────────────

export type FilterStatus = 'booked' | 'cancelled';
export type WizardStep = 1 | 2 | 3;

export interface WizardState {
  buildingId: string;
  plateNumber: string;
  vehicleTypeId: string;
  floorId: string;
  slotId: string;
  startTime: string;
  endTime: string;
}

export const EMPTY_WIZARD: WizardState = {
  buildingId: '',
  plateNumber: '',
  vehicleTypeId: '',
  floorId: '',
  slotId: '',
  startTime: '',
  endTime: '',
};

// Helper thuần cho BookingDateModal (lịch + slot giờ + format ngày hiển thị).

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// Generates time slots from 00:00 to 23:30 (30-minute intervals)
export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

/**
 * Chuẩn hóa giới hạn đặt chỗ theo ReservationPolicy của tòa;
 * fallback = hành vi cũ (7 ngày đặt trước, tối đa 30 ngày = 720h).
 */
export function policyLimits(maxAdvanceDays?: number, maxDurationHours?: number) {
  const advanceDays = Math.max(1, Math.round(maxAdvanceDays ?? 7));
  const durationHours = Math.max(1, Math.round(maxDurationHours ?? 720));
  const durationDays = Math.max(1, Math.floor(durationHours / 24));
  return {
    advanceDays,
    durationDays,
    hourChipMax: Math.min(24, durationHours),
    defaultDailySpan: Math.min(7, durationDays),
    quickDays: [7, 30].filter((d) => d <= durationDays),
  };
}

/**
 * Slot giờ đã qua (chỉ áp dụng khi check-in là hôm nay).
 * BE cho phép trễ tối đa 1 giờ so với hiện tại.
 */
export function isTimeSlotPast(checkinDate: Date, timeStr: string): boolean {
  const today = new Date();
  if (checkinDate.toDateString() !== today.toDateString()) return false;
  const [hStr, mStr] = timeStr.split(':');
  const slotDate = new Date(today);
  slotDate.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
  const allowedTime = new Date(today.getTime() - 60 * 60 * 1000);
  return slotDate < allowedTime;
}

// Helper: format date for display
export function fmtDisplayDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}, ${d}/${m}/${y}`;
}

import { policyLimits, isTimeSlotPast } from '@/components/ui/BookingDateModal.utils';

describe('policyLimits', () => {
  it('falls back to legacy defaults when policy is missing', () => {
    expect(policyLimits(undefined, undefined)).toEqual({
      advanceDays: 7,
      durationDays: 30,
      hourChipMax: 24,
      defaultDailySpan: 7,
      quickDays: [7, 30],
    });
  });

  it('derives limits from the building policy', () => {
    // maxDurationHours = 168h (7 ngày) → không còn quick 30 ngày.
    expect(policyLimits(3, 168)).toEqual({
      advanceDays: 3,
      durationDays: 7,
      hourChipMax: 24,
      defaultDailySpan: 7,
      quickDays: [7],
    });
  });

  it('caps hour chips and hides quick days for a 24h-max policy (BE default)', () => {
    const limits = policyLimits(7, 24);
    expect(limits.durationDays).toBe(1);
    expect(limits.hourChipMax).toBe(24);
    expect(limits.defaultDailySpan).toBe(1);
    expect(limits.quickDays).toEqual([]);
  });

  it('clamps degenerate values to at least 1', () => {
    const limits = policyLimits(0, 0);
    expect(limits.advanceDays).toBe(1);
    expect(limits.durationDays).toBe(1);
    expect(limits.hourChipMax).toBe(1);
  });
});

describe('isTimeSlotPast', () => {
  it('never marks slots on a future date as past', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isTimeSlotPast(tomorrow, '00:00')).toBe(false);
  });

  it('marks a slot more than 1h before now as past (today only)', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    // Chỉ chạy nhánh này khi 2h trước vẫn là hôm nay (tránh flaky lúc 0h–2h).
    if (past.toDateString() === now.toDateString()) {
      const timeStr = `${String(past.getHours()).padStart(2, '0')}:00`;
      expect(isTimeSlotPast(now, timeStr)).toBe(true);
    }
    // Slot ngay hiện tại luôn hợp lệ (trong buffer 1h của BE).
    const currentStr = `${String(now.getHours()).padStart(2, '0')}:${now.getMinutes() >= 30 ? '30' : '00'}`;
    expect(isTimeSlotPast(now, currentStr)).toBe(false);
  });
});

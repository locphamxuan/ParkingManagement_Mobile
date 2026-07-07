import {
  isCancelled,
  statusVariant,
  statusLabel,
  fmtVND,
  splitSlotsSymmetrically,
  toWizardStr,
} from '@/utils/reservationFormat';
import type { SlotItem } from '@/services/floors';

const slot = (code: string): SlotItem => ({ _id: code, code, status: 'available' });

describe('trạng thái reservation', () => {
  it('isCancelled đúng với cancelled/expired', () => {
    expect(isCancelled('cancelled')).toBe(true);
    expect(isCancelled('expired')).toBe(true);
    expect(isCancelled('confirmed')).toBe(false);
    expect(isCancelled('pending')).toBe(false);
  });

  it('statusVariant: cancelled → error, còn lại → info', () => {
    expect(statusVariant('cancelled')).toBe('error');
    expect(statusVariant('confirmed')).toBe('info');
  });

  it('statusLabel: cancelled → Cancelled, còn lại → Booked', () => {
    expect(statusLabel('expired')).toBe('Cancelled');
    expect(statusLabel('confirmed')).toBe('Booked');
  });
});

describe('fmtVND', () => {
  it('định dạng tiền + hậu tố VND', () => {
    expect(fmtVND(20000)).toBe('20,000 VND');
  });
});

describe('splitSlotsSymmetrically', () => {
  it('chẵn lên hàng trên, lẻ xuống hàng dưới (đã sort theo số)', () => {
    const { topRowSlots, bottomRowSlots } = splitSlotsSymmetrically([
      slot('3'), slot('1'), slot('4'), slot('2'),
    ]);
    expect(topRowSlots.map((s) => s.code)).toEqual(['2', '4']);
    expect(bottomRowSlots.map((s) => s.code)).toEqual(['1', '3']);
  });

  it('mã có gạch/gạch dưới luôn lên hàng trên', () => {
    const { topRowSlots } = splitSlotsSymmetrically([slot('A-1'), slot('B_2')]);
    expect(topRowSlots.map((s) => s.code).sort()).toEqual(['A-1', 'B_2']);
  });
});

describe('toWizardStr', () => {
  it('format Date → "YYYY-MM-DD HH:MM" theo giờ local', () => {
    // Tạo từ thành phần local nên không phụ thuộc múi giờ.
    expect(toWizardStr(new Date(2026, 6, 6, 9, 5))).toBe('2026-07-06 09:05');
  });
});

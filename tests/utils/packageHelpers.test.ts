import { fmtMoney, fmtDateOnly, vtLabel, vtCode, groupByBuilding } from '@/utils/packageHelpers';
import type { LongTermPackage } from '@/types';

const pkg = (over: Partial<LongTermPackage>): LongTermPackage => ({
  _id: over._id ?? 'p1',
  name: over.name ?? 'Gói tháng',
  durationDays: over.durationDays ?? 30,
  price: over.price ?? 500000,
  ...over,
});

describe('fmtMoney', () => {
  it('định dạng số có phân tách nghìn + hậu tố VND', () => {
    expect(fmtMoney(500000)).toBe('500,000 VND');
    expect(fmtMoney(0)).toBe('0 VND');
  });
});

describe('fmtDateOnly', () => {
  it('trả dd/mm/yyyy', () => {
    // Dùng thời gian giữa ngày (local) để tránh lệch múi giờ ở biên nửa đêm.
    expect(fmtDateOnly('2026-07-06T12:00:00')).toBe('06/07/2026');
  });
  it('trả — khi rỗng', () => {
    expect(fmtDateOnly('')).toBe('—');
  });
});

describe('vtLabel', () => {
  it('map mã chuỗi sang nhãn', () => {
    expect(vtLabel('car')).toBe('Car');
    expect(vtLabel('motorcycle')).toBe('Motorcycle');
    expect(vtLabel('all')).toBe('All vehicles');
  });
  it('null → All vehicles', () => {
    expect(vtLabel(null)).toBe('All vehicles');
  });
  it('object → dùng name', () => {
    expect(vtLabel({ _id: 'v1', name: 'Ô tô con', code: 'CAR' })).toBe('Ô tô con');
  });
});

describe('vtCode', () => {
  it('object → code', () => {
    expect(vtCode({ _id: 'v1', name: 'Ô tô', code: 'CAR' })).toBe('CAR');
  });
  it('chuỗi/null → null', () => {
    expect(vtCode('car')).toBeNull();
    expect(vtCode(null)).toBeNull();
  });
});

describe('groupByBuilding', () => {
  it('gom gói theo _id toà nhà', () => {
    const a = pkg({ _id: 'p1', building: { _id: 'b1', name: 'Toà A', code: 'A' } });
    const b = pkg({ _id: 'p2', building: { _id: 'b1', name: 'Toà A', code: 'A' } });
    const c = pkg({ _id: 'p3', building: { _id: 'b2', name: 'Toà B', code: 'B' } });

    const groups = groupByBuilding([a, b, c]);
    expect(groups).toHaveLength(2);
    const g1 = groups.find((g) => g.building?._id === 'b1');
    expect(g1?.packages.map((p) => p._id)).toEqual(['p1', 'p2']);
  });

  it('gói thiếu building gom vào nhóm __unknown__', () => {
    const groups = groupByBuilding([pkg({ _id: 'p9' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].building).toBeNull();
  });
});

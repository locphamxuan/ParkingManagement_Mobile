import { guessVehicleCategory, normalizePlate, PLATE_REGEX } from '@/utils/vehicle';

describe('guessVehicleCategory', () => {
  it('nhận diện xe máy qua từ khóa', () => {
    expect(guessVehicleCategory('Xe máy')).toBe('motorcycle');
    expect(guessVehicleCategory('Motorbike')).toBe('motorcycle');
    expect(guessVehicleCategory('motorcycle')).toBe('motorcycle');
  });

  it('mặc định là ô tô', () => {
    expect(guessVehicleCategory('Ô tô')).toBe('car');
    expect(guessVehicleCategory('Sedan')).toBe('car');
    expect(guessVehicleCategory('')).toBe('car');
  });
});

// Hành vi CHUẨN theo spec (OpenSpec fix-mobile-plate-normalization) — mirror
// BE plate.util.js / FE web utils/plate.ts: chuỗi số THÔ 5 số → NNN.NN;
// ≥6 số → 1 số đầu là series digit; series chữ+số của biển 4 số nhận qua
// dấu phân cách tường minh (51F1-2345).
describe('normalizePlate (chuẩn hóa đồng bộ BE/FE)', () => {
  it('chuỗi số liền 5 số → dạng NNN.NN', () => {
    expect(normalizePlate('51F97022')).toBe('51F-970.22');
    expect(normalizePlate('29AB22658')).toBe('29AB-226.58');
    expect(normalizePlate('99H77060')).toBe('99H-770.60');
  });

  it('chuỗi số liền ≥6 số → tách series digit + 5 số NNN.NN', () => {
    expect(normalizePlate('51F123456')).toBe('51F1-234.56');
  });

  it('series chữ+số của biển 4 số qua dấu phân cách tường minh', () => {
    expect(normalizePlate('51F1-2345')).toBe('51F1-2345');
    expect(normalizePlate('99h7 7060')).toBe('99H7-7060');
  });

  it('idempotent với biển đã canonical', () => {
    expect(normalizePlate('51F-970.22')).toBe('51F-970.22');
    expect(normalizePlate('30LD-1234')).toBe('30LD-1234');
  });

  it('bỏ khoảng trắng và viết hoa', () => {
    expect(normalizePlate('  51f 970 22 ')).toBe('51F-970.22');
  });

  it('trả nguyên (upper + trim) khi không parse được', () => {
    expect(normalizePlate('abc')).toBe('ABC');
  });
});

describe('PLATE_REGEX', () => {
  it('khớp biển canonical', () => {
    expect(PLATE_REGEX.test('51F-970.22')).toBe(true);
    expect(PLATE_REGEX.test('51F1-2345')).toBe(true);
  });
  it('không khớp biển thiếu định dạng', () => {
    expect(PLATE_REGEX.test('51F97022')).toBe(false);
  });
});

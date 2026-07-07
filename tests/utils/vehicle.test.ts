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

// NOTE: test đặc tả (characterization) — khóa lại HÀNH VI HIỆN TẠI của normalizePlate.
// Với chuỗi số liền, regex `([A-Z]{1,2}\d?)` "ăn" tham lam 1 chữ số vào series
// (vd 51F97022 → series "F9", số "7022"), nên KHÔNG tự tạo dạng 5 số NNN.NN từ
// chuỗi số thô — chỉ nhánh có sẵn dấu chấm mới ra NNN.NN. (Khác impl bên FE.)
describe('normalizePlate (hành vi hiện tại)', () => {
  it('chuỗi số liền: chữ số đầu của phần số bị gộp vào series', () => {
    expect(normalizePlate('51F97022')).toBe('51F9-7022');
    expect(normalizePlate('29AB22658')).toBe('29AB2-2658');
    expect(normalizePlate('99H77060')).toBe('99H7-7060');
  });

  it('idempotent với biển đã có dấu chấm (nhánh m5dot)', () => {
    expect(normalizePlate('51F-970.22')).toBe('51F-970.22');
  });

  it('bỏ khoảng trắng và viết hoa', () => {
    expect(normalizePlate('  51f 970 22 ')).toBe('51F9-7022');
  });

  it('trả nguyên (upper, bỏ space) khi không khớp mẫu', () => {
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

export function guessVehicleCategory(name: string): 'car' | 'motorcycle' {
  const lower = (name || '').toLowerCase();
  if (/motor|moto|bike|motorcycle|máy|may/.test(lower)) return 'motorcycle';
  return 'car';
}

const motorcyclePlateTypes = new Set(['motorcycle', 'ebike', 'emotorbike']);

export function vehicleCategoryFromPlate(type?: string | null): 'car' | 'motorcycle' {
  return motorcyclePlateTypes.has(String(type || '').toLowerCase()) ? 'motorcycle' : 'car';
}

export function vehicleCategoryFromVehicleType(
  vehicleType?: string | { code?: string; name?: string } | null,
): 'car' | 'motorcycle' {
  const label = typeof vehicleType === 'string'
    ? vehicleType
    : `${vehicleType?.code || ''} ${vehicleType?.name || ''}`;
  return guessVehicleCategory(label);
}

// ─── License plate helpers ────────────────────────────────────────────────────
// Canonical VN plate formats:
//   4-digit number → series = letter+digit  (e.g. 51F1-2345, 99H7-7060)
//   5-digit number → series = 1 letter (car) or 2 letters (moto) (e.g. 51F-970.22, 29AB-226.58)
export const PLATE_REGEX = /^\d{2}(?:[A-Z]{1,2}|[A-Z]\d)-(?:\d{3}\.\d{2}|\d{4})$/;

/**
 * Mirror thuật toán của BE `plate.util.js` / FE web `utils/plate.ts` để 3 repo
 * chuẩn hóa GIỐNG NHAU (fix OpenSpec fix-mobile-plate-normalization):
 *  - Tách số trước, suy luận series sau (regex cũ `([A-Z]{1,2}\d?)` greedy nên
 *    `51F97022` bị ăn thành `51F9-7022` thay vì `51F-970.22`).
 *  - Chuỗi số THÔ: ≥6 số → 1 số đầu là series digit + 5 số dạng NNN.NN;
 *    5 số → NNN.NN; 4 số → giữ nguyên. Series chữ+số với biển 4 số
 *    (`51F1-2345`) nhận qua DẤU PHÂN CÁCH tường minh (-, _, ., space).
 *  - Khác FE web: input không parse được trả về upper+trim (không trả '' —
 *    call site Mobile hiển thị lại chuỗi người dùng nhập).
 */
export function normalizePlate(raw: string): string {
  const fallback = (raw ?? '').trim().toUpperCase();

  const head = fallback.match(/^(\d{2})[^A-Z0-9]*([A-Z]{1,2})(.*)$/);
  if (!head) return fallback;
  const province = head[1];
  const letters = head[2];
  const rest = head[3];

  let seriesDigit = '';
  let numberDigits: string;

  const sep = rest.match(/^\s*(\d?)\s*[-_.\s]+\s*([\d.\s]+)$/);
  if (sep) {
    seriesDigit = sep[1] || '';
    numberDigits = sep[2].replace(/[^0-9]/g, '');
  } else {
    const tail = rest.replace(/[^0-9]/g, '');
    if (tail.length >= 6) {
      seriesDigit = tail.slice(0, tail.length - 5);
      numberDigits = tail.slice(tail.length - 5);
    } else {
      numberDigits = tail;
    }
  }

  if (seriesDigit.length > 1) return fallback;
  if (numberDigits.length < 4 || numberDigits.length > 5) return fallback;

  const formattedNumber =
    numberDigits.length === 5
      ? `${numberDigits.slice(0, 3)}.${numberDigits.slice(3)}`
      : numberDigits;

  return `${province}${letters}${seriesDigit}-${formattedNumber}`;
}

export function guessVehicleCategory(name: string): 'car' | 'motorcycle' {
  const lower = (name || '').toLowerCase();
  if (/motor|moto|bike|motorcycle/.test(lower)) return 'motorcycle';
  return 'car';
}

// ─── License plate helpers ────────────────────────────────────────────────────
// Canonical VN plate formats:
//   4-digit number → series = letter+digit  (e.g. 51F1-2345, 99H7-7060)
//   5-digit number → series = 1 letter (car) or 2 letters (moto) (e.g. 51F-970.22, 29AB-226.58)
export const PLATE_REGEX = /^\d{2}(?:[A-Z]{1,2}|[A-Z]\d)-(?:\d{3}\.\d{2}|\d{4})$/;

export function normalizePlate(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  // NNN.NN format (5-digit with dot already present)
  const m5dot = s.match(/^(\d{2})([A-Z]{1,2}\d?)-?(\d{3})\.(\d{2})$/);
  if (m5dot) return `${m5dot[1]}${m5dot[2]}-${m5dot[3]}.${m5dot[4]}`;
  // Straight digits (4 or 5) — format 5-digit as NNN.NN
  const m = s.match(/^(\d{2})([A-Z]{1,2}\d?)-?(\d{4,5})$/);
  if (m) {
    const digits = m[3];
    const num = digits.length === 5 ? `${digits.slice(0, 3)}.${digits.slice(3)}` : digits;
    return `${m[1]}${m[2]}-${num}`;
  }
  return s;
}

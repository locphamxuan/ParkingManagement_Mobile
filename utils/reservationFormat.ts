import type { SlotItem } from '../services/floors';

// Note: this file used to also hold reservation status/date/money formatters and
// the hourly-booking wizard's types (fmtDate/isCancelled/statusVariant/statusLabel/
// fmtVND/toWizardStr/FilterStatus/WizardStep/WizardState/EMPTY_WIZARD). They had
// zero remaining callers once the orphaned wizard tree (ReservationWizard/
// WizardStep1-3/ReservationCard/useReservations) was deleted and were removed here
// too (2026-07-23 audit) — splitSlotsSymmetrically is the only survivor, still used
// by SlotMapModal.tsx for the 2D/3D parking layout.

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

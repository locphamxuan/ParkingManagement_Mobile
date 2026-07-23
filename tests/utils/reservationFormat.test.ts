import { splitSlotsSymmetrically } from '@/utils/reservationFormat';
import type { SlotItem } from '@/services/floors';

const slot = (code: string): SlotItem => ({ _id: code, code, status: 'available' });

// NOTE: fmtDate/isCancelled/statusVariant/statusLabel/fmtVND/toWizardStr and the
// wizard types (FilterStatus/WizardStep/WizardState/EMPTY_WIZARD) used to be
// tested here too, but they had zero remaining callers in the app once the
// orphaned wizard tree was deleted (see CLAUDE.md) — removed together with the
// dead exports in utils/reservationFormat.ts (2026-07-23 audit).

describe('splitSlotsSymmetrically', () => {
  // ⚠️ Red on purpose (see CLAUDE.md "reservationFormat" section): this test
  // encodes the ORIGINAL generic even/odd + dash-priority split algorithm,
  // which utils/reservationFormat.ts no longer implements — it was deliberately
  // replaced by a car/moto category split (commit 3d1b13b) to support T1/T2
  // rows on floors with mixed vehicle types. Needs a product decision on
  // whether to update this test to the new behavior or restore the old one;
  // do not silently "fix" by guessing.
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

import { splitSlotsSymmetrically } from '@/utils/slotLayout';
import type { SlotItem } from '@/services/floors';

const slot = (code: string, vehicleTypeName?: string): SlotItem => ({
  _id: code,
  code,
  status: 'available',
  ...(vehicleTypeName ? { vehicleType: { _id: vehicleTypeName, name: vehicleTypeName } } : {}),
});

describe('splitSlotsSymmetrically', () => {
  // Real callsite (SlotMapModal) always pre-filters to a single vehicle
  // category before calling this, so in practice every slot lands in the
  // same bucket (cars or motos) and the function falls back to a plain
  // positional halve — no sorting, original array order preserved.
  it('falls back to a plain positional split when all slots are the same category', () => {
    const { topRowSlots, bottomRowSlots } = splitSlotsSymmetrically([
      slot('3'), slot('1'), slot('4'), slot('2'),
    ]);
    expect(topRowSlots.map((s) => s.code)).toEqual(['3', '1']);
    expect(bottomRowSlots.map((s) => s.code)).toEqual(['4', '2']);
  });

  it('rounds the top row up on an odd-length fallback split', () => {
    const { topRowSlots, bottomRowSlots } = splitSlotsSymmetrically([slot('A-1'), slot('B_2')]);
    expect(topRowSlots.map((s) => s.code)).toEqual(['A-1']);
    expect(bottomRowSlots.map((s) => s.code)).toEqual(['B_2']);
  });

  // Exercises the car/moto branch directly — not reachable through the real
  // callsite today (it pre-filters by category), but the function still
  // implements this split whenever a mixed-category list is passed in.
  it('splits by vehicle category (car row on top, moto row on bottom) when both are present', () => {
    const { topRowSlots, bottomRowSlots } = splitSlotsSymmetrically([
      slot('A-1', 'car'), slot('M-1', 'motorcycle'), slot('A-2', 'car'),
    ]);
    expect(topRowSlots.map((s) => s.code)).toEqual(['A-1', 'A-2']);
    expect(bottomRowSlots.map((s) => s.code)).toEqual(['M-1']);
  });
});

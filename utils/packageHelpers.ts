import type { LongTermPackage } from '../types';

export function fmtMoney(n: number) {
  return `${n.toLocaleString('en-US')} VND`;
}

export function fmtDateOnly(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function vtLabel(vt: LongTermPackage['vehicleType']): string {
  if (!vt) return 'All vehicles';
  if (typeof vt === 'string') {
    if (vt === 'car') return 'Car';
    if (vt === 'motorcycle') return 'Motorcycle';
    if (vt === 'all') return 'All vehicles';
    return vt;
  }
  return vt.name ?? 'All vehicles';
}

export function vtCode(vt: LongTermPackage['vehicleType']): string | null {
  if (!vt || typeof vt === 'string') return null;
  return vt.code ?? null;
}

// Group packages by building
export function groupByBuilding(packages: LongTermPackage[]) {
  const map = new Map<string, { building: LongTermPackage['building']; packages: LongTermPackage[] }>();
  for (const pkg of packages) {
    const key = pkg.building?._id ?? '__unknown__';
    if (!map.has(key)) {
      map.set(key, { building: pkg.building ?? null, packages: [] });
    }
    map.get(key)!.packages.push(pkg);
  }
  return Array.from(map.values());
}

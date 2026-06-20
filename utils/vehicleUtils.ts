export function guessVehicleCategory(name: string): 'car' | 'motorcycle' {
  const lower = (name || '').toLowerCase();
  if (/motor|moto|bike|motorcycle/.test(lower)) return 'motorcycle';
  return 'car';
}

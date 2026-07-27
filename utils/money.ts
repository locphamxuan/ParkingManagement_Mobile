/** Shared VND currency formatter (was duplicated verbatim in packageHelpers.ts and walletHelpers.ts). */
export function fmtMoney(n: number) {
  return `${n.toLocaleString('en-US')} VND`;
}

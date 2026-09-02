// Amounts are stored as integers in satang (1 THB = 100 satang).

export function toSatang(baht: number): number {
  return Math.round(baht * 100);
}

/** Inverse of toSatang — a plain number for pre-filling edit forms (use
 *  formatBaht instead when displaying an amount to the user). */
export function toBaht(satang: number): number {
  return satang / 100;
}

export function formatBaht(satang: number): string {
  const baht = satang / 100;
  return baht.toLocaleString("th-TH", {
    minimumFractionDigits: baht % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

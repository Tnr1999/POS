// Amounts are stored as integers in satang (1 THB = 100 satang).

export function toSatang(baht: number): number {
  return Math.round(baht * 100);
}

export function formatBaht(satang: number): string {
  const baht = satang / 100;
  return baht.toLocaleString("th-TH", {
    minimumFractionDigits: baht % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

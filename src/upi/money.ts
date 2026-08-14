/** Integer paise only. Never use floating-point for stored money. */

export const MIN_AMOUNT_PAISE = 100; // ₹1
export const MAX_AMOUNT_PAISE = 10_000_000; // ₹1,00,000 sane ceiling

export function paiseToRupeeLabel(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  return `${sign}${rupees}.${String(fraction).padStart(2, '0')}`;
}

export function parseRupeeInputToPaise(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null;
  }
  const [rupeePart, paisePart = ''] = trimmed.split('.');
  const rupees = Number.parseInt(rupeePart, 10);
  if (!Number.isSafeInteger(rupees) || rupees < 0) {
    return null;
  }
  const paiseDigits = (paisePart + '00').slice(0, 2);
  const paise = Number.parseInt(paiseDigits, 10);
  const total = rupees * 100 + paise;
  if (!Number.isSafeInteger(total)) {
    return null;
  }
  return total;
}

export function parseAmountParamToPaise(raw: string): number | null {
  return parseRupeeInputToPaise(raw);
}

export function isSaneAmountPaise(paise: number): boolean {
  return Number.isSafeInteger(paise) && paise >= MIN_AMOUNT_PAISE && paise <= MAX_AMOUNT_PAISE;
}

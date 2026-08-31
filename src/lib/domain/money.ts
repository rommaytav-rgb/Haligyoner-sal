/**
 * Money handling.
 *
 * Every monetary value in this application is stored and computed as an integer
 * number of agorot (1 ILS = 100 agorot). Floating point is never used for money
 * arithmetic, because repeated float addition over a basket introduces drift
 * that would make totals disagree with their own line items.
 */

export type Agorot = number;

export const CURRENCY = 'ILS' as const;

export class MoneyError extends Error {}

/** Converts shekels (possibly fractional) to agorot, rounding half away from zero. */
export function shekelsToAgorot(shekels: number): Agorot {
  if (!Number.isFinite(shekels)) throw new MoneyError(`Not a finite amount: ${shekels}`);
  return roundHalfAwayFromZero(shekels * 100);
}

/**
 * Rounds half away from zero, correcting for binary representation error.
 *
 * `Math.round` rounds half *up*, which is asymmetric for negative deltas, and
 * plain multiplication puts values like 1.005 * 100 at 100.49999999999999 — a
 * naive round would report ₪1.00 for a ₪1.005 price. The epsilon nudge is scaled
 * to the magnitude of the value so it corrects representation error without
 * shifting genuinely-below-half values.
 */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) throw new MoneyError(`Not a finite amount: ${value}`);
  const nudged = Math.abs(value) + Number.EPSILON * Math.abs(value);
  const rounded = Math.round(nudged);
  return value < 0 ? -rounded : rounded;
}

/** Converts agorot to a floating point shekel amount. Display only — never feed back into arithmetic. */
export function agorotToShekels(agorot: Agorot): number {
  return agorot / 100;
}

export function assertAgorot(value: number, label = 'amount'): Agorot {
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of agorot, received ${value}`);
  }
  return value;
}

/** Sums agorot values exactly. */
export function sumAgorot(values: readonly Agorot[]): Agorot {
  let total = 0;
  for (const v of values) total += assertAgorot(v, 'summand');
  return total;
}

/**
 * Multiplies a unit price by a quantity.
 * Quantity may be fractional (e.g. 1.5 kg of chicken); the result is rounded to
 * the nearest agora, half away from zero.
 */
export function multiplyAgorot(unitPrice: Agorot, quantity: number): Agorot {
  assertAgorot(unitPrice, 'unitPrice');
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new MoneyError(`Quantity must be a non-negative finite number, received ${quantity}`);
  }
  return roundHalfAwayFromZero(unitPrice * quantity);
}

/** Formats agorot for display, e.g. 1234 -> "₪12.34", 1200 -> "₪12". */
export function formatAgorot(agorot: Agorot, locale: 'he' | 'en' = 'he'): string {
  assertAgorot(agorot, 'amount');
  const negative = agorot < 0;
  const abs = Math.abs(agorot);
  const shekels = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = shekels.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
  const body = rest === 0 ? grouped : `${grouped}.${String(rest).padStart(2, '0')}`;
  return `${negative ? '−' : ''}₪${body}`;
}

/** Formats a signed delta, e.g. +200 -> "+₪2", -200 -> "−₪2". */
export function formatAgorotDelta(agorot: Agorot, locale: 'he' | 'en' = 'he'): string {
  if (agorot === 0) return formatAgorot(0, locale);
  const sign = agorot > 0 ? '+' : '';
  return `${sign}${formatAgorot(agorot, locale)}`;
}

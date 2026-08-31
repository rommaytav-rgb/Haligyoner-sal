/**
 * Package size parsing and unit-price normalisation.
 *
 * Two products are only comparable per-unit when they resolve to the same base
 * unit (grams, millilitres, or a countable piece). Anything we cannot parse
 * confidently stays unparsed — a wrong unit price is worse than none.
 */

import { assertAgorot, type Agorot } from './money';
import { roundTo } from './price-change';

export type BaseUnit = 'g' | 'ml' | 'unit';

export interface PackageSize {
  /** Quantity expressed in the base unit (grams / millilitres / pieces). */
  baseQuantity: number;
  baseUnit: BaseUnit;
  /** How the size was written on the label, for display. */
  rawText: string;
  /** Number of identical items in a multipack, e.g. "6 x 1.5L" -> 6. */
  multipack: number;
}

const WEIGHT_TO_GRAMS: Record<string, number> = {
  kg: 1000, "ק\"ג": 1000, 'קג': 1000, 'קילו': 1000, 'קילוגרם': 1000,
  g: 1, gr: 1, gram: 1, grams: 1, 'גרם': 1, "ג'": 1, 'גר': 1,
};

const VOLUME_TO_ML: Record<string, number> = {
  l: 1000, lt: 1000, ltr: 1000, liter: 1000, litre: 1000, liters: 1000,
  'ליטר': 1000, 'ל': 1000,
  ml: 1, mls: 1, 'מל': 1, "מ\"ל": 1, 'מיליליטר': 1,
  cc: 1,
};

const COUNT_UNITS = new Set([
  'unit', 'units', 'pc', 'pcs', 'piece', 'pieces', 'x',
  "יח'", 'יח', 'יחידה', 'יחידות', 'מארז', 'גליל', 'גלילים',
]);

/** Latin + Hebrew digits are the same; normalise decimal separators and spacing. */
function cleanNumber(raw: string): number | null {
  const normalised = raw.replace(',', '.').trim();
  const value = Number.parseFloat(normalised);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const SIZE_PATTERN =
  /(?:(\d+(?:[.,]\d+)?)\s*[xX×*]\s*)?(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+|[֐-׿"']+)/g;

/**
 * Extracts a package size from a free-form product name.
 * Returns null when nothing recognisable is present.
 */
export function parsePackageSize(name: string): PackageSize | null {
  if (!name) return null;
  SIZE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let best: PackageSize | null = null;

  while ((match = SIZE_PATTERN.exec(name)) !== null) {
    const multiRaw = match[1];
    const amountRaw = match[2];
    const unitRaw = match[3];
    if (!amountRaw || !unitRaw) continue;

    const amount = cleanNumber(amountRaw);
    if (amount === null) continue;
    const multipack = multiRaw ? (cleanNumber(multiRaw) ?? 1) : 1;
    const unit = unitRaw.toLowerCase().replace(/[.]/g, '');

    let baseUnit: BaseUnit | null = null;
    let factor = 0;
    if (unit in WEIGHT_TO_GRAMS) {
      baseUnit = 'g';
      factor = WEIGHT_TO_GRAMS[unit] as number;
    } else if (unit in VOLUME_TO_ML) {
      baseUnit = 'ml';
      factor = VOLUME_TO_ML[unit] as number;
    } else if (COUNT_UNITS.has(unit)) {
      baseUnit = 'unit';
      factor = 1;
    }
    if (!baseUnit) continue;

    const candidate: PackageSize = {
      baseQuantity: roundTo(amount * factor * multipack, 4),
      baseUnit,
      rawText: match[0].trim(),
      multipack,
    };
    // Prefer a weight/volume match over a bare count, and larger explicit sizes
    // over incidental numbers ("3%" never matches because % is not a unit).
    if (!best || (best.baseUnit === 'unit' && candidate.baseUnit !== 'unit')) {
      best = candidate;
    }
  }
  return best;
}

export interface UnitPrice {
  baseUnit: BaseUnit;
  /** Price in agorot for one base unit (1 g / 1 ml / 1 piece). */
  pricePerBaseUnitAgorot: number;
  /** Convenience projections, in agorot. */
  perKgAgorot: number | null;
  perLitreAgorot: number | null;
  per100gAgorot: number | null;
  per100mlAgorot: number | null;
  perUnitAgorot: number | null;
}

/**
 * Computes the unit price of a package.
 * Returns null when the package size is unknown or zero — we do not guess.
 */
export function computeUnitPrice(priceAgorot: Agorot, size: PackageSize | null): UnitPrice | null {
  assertAgorot(priceAgorot, 'price');
  if (!size || size.baseQuantity <= 0) return null;
  const per = priceAgorot / size.baseQuantity;
  return {
    baseUnit: size.baseUnit,
    pricePerBaseUnitAgorot: roundTo(per, 4),
    perKgAgorot: size.baseUnit === 'g' ? roundTo(per * 1000, 2) : null,
    perLitreAgorot: size.baseUnit === 'ml' ? roundTo(per * 1000, 2) : null,
    per100gAgorot: size.baseUnit === 'g' ? roundTo(per * 100, 2) : null,
    per100mlAgorot: size.baseUnit === 'ml' ? roundTo(per * 100, 2) : null,
    perUnitAgorot: size.baseUnit === 'unit' ? roundTo(per, 2) : null,
  };
}

/** True when two unit prices describe the same base unit and can be ranked. */
export function isComparable(a: UnitPrice | null, b: UnitPrice | null): boolean {
  return a !== null && b !== null && a.baseUnit === b.baseUnit;
}

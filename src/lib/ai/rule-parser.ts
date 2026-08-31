/**
 * Deterministic basket-text parser.
 *
 * This is both the offline fallback for the AI parser and the validator for its
 * output: whatever the model returns, the quantities and flags below are what the
 * application trusts when the model's answer is unusable.
 *
 * It never invents products. Anything it cannot classify stays as raw text on the
 * line, and matching against the catalog happens later.
 */

export type ParsedSubstitutionPolicy = 'allow' | 'same_brand_only' | 'never';

export interface ParsedBasketItem {
  rawText: string;
  quantity: number;
  preferredBrand: string | null;
  substitutionPolicy: ParsedSubstitutionPolicy;
  isLocked: boolean;
  isOptional: boolean;
  /** Which rule produced the quantity, for transparency in the UI. */
  quantitySource: 'explicit' | 'default';
}

export interface ParsedBasket {
  items: ParsedBasketItem[];
  warnings: string[];
}

const BULLETS = /^[\s]*[-–—*•·]+\s*/;

/** Phrases that lock a line against substitution. */
const NEVER_SUBSTITUTE = [
  'בלי תחליפים',
  'לא להחליף',
  'אל תחליף',
  'רק את זה',
  'בדיוק',
  'no substitute',
  'no substitutes',
  "don't replace",
  'do not replace',
  'exactly this',
];

/** Phrases that explicitly open a line to substitution. */
const ANY_BRAND = [
  'לא משנה המותג',
  'לא חשוב המותג',
  'כל מותג',
  'any brand',
  "don't care about brand",
  'no brand preference',
];

const OPTIONAL = ['אם יש', 'לא חובה', 'אופציונלי', 'if available', 'optional', 'nice to have'];

const UNIT_WORDS = [
  'יח', "יח'", 'יחידות', 'יחידה', 'ק"ג', 'קג', 'קילו', 'קילוגרם', 'גרם', 'ליטר', 'מארז', 'בקבוק', 'בקבוקים',
  'units', 'unit', 'pcs', 'pieces', 'kg', 'kilo', 'g', 'l', 'liter', 'litre', 'ml', 'pack', 'packs', 'bottles',
];

function stripPhrases(text: string, phrases: readonly string[]): { text: string; matched: boolean } {
  let result = text;
  let matched = false;
  for (const phrase of phrases) {
    const index = result.toLowerCase().indexOf(phrase.toLowerCase());
    if (index !== -1) {
      matched = true;
      result = `${result.slice(0, index)} ${result.slice(index + phrase.length)}`;
    }
  }
  // Stripping a trailing phrase often leaves the separator that introduced it.
  const cleaned = result.replace(/\s+/g, ' ').trim().replace(/[\s\-–—:,]+$/, '').trim();
  return { text: cleaned, matched };
}

/**
 * Splits free-form input into candidate lines. Commas separate items only when
 * the input has no line breaks, so "חלב, ביצים, לחם" works while a single item
 * containing a comma survives a multi-line list.
 */
export function splitLines(input: string): string[] {
  const byNewline = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (byNewline.length > 1) return byNewline;
  return input
    .split(/[,،;]|\bו-(?=\S)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const LEADING_QUANTITY = /^(\d+(?:[.,]\d+)?)\s*(?:[xX×*]\s*)?(.*)$/;
const TRAILING_QUANTITY = /^(.*?)[\s]*[xX×*][\s]*(\d+(?:[.,]\d+)?)$/;

/**
 * Extracts a quantity from a line.
 *
 * A leading number is only a quantity when it is not immediately followed by a
 * unit word — "2 קילו עוף" is one kilo-priced line of quantity 2, but "1 ליטר
 * חלב" is a package size, not a count, so it stays in the text and the quantity
 * defaults to 1.
 */
export function extractQuantity(line: string): { quantity: number; text: string; source: 'explicit' | 'default' } {
  const trailing = TRAILING_QUANTITY.exec(line);
  if (trailing && trailing[1] && trailing[2]) {
    const value = Number.parseFloat(trailing[2].replace(',', '.'));
    if (Number.isFinite(value) && value > 0) {
      return { quantity: value, text: trailing[1].trim(), source: 'explicit' };
    }
  }

  const leading = LEADING_QUANTITY.exec(line);
  if (leading && leading[1] !== undefined && leading[2] !== undefined) {
    const value = Number.parseFloat(leading[1].replace(',', '.'));
    const rest = leading[2].trim();
    const firstWord = rest.split(/\s+/)[0]?.toLowerCase().replace(/[.]/g, '') ?? '';
    const followedByUnit = UNIT_WORDS.includes(firstWord);
    if (Number.isFinite(value) && value > 0 && rest.length > 0 && !followedByUnit) {
      return { quantity: value, text: rest, source: 'explicit' };
    }
    // "2 קילו עוף": the number belongs to the unit, so keep both in the text and
    // treat the count of packages as the number itself.
    if (Number.isFinite(value) && value > 0 && followedByUnit) {
      return { quantity: value, text: rest, source: 'explicit' };
    }
  }

  return { quantity: 1, text: line.trim(), source: 'default' };
}

export function parseBasketTextWithRules(input: string): ParsedBasket {
  const warnings: string[] = [];
  const items: ParsedBasketItem[] = [];

  for (const rawLine of splitLines(input)) {
    const withoutBullet = rawLine.replace(BULLETS, '').trim();
    if (withoutBullet.length === 0) continue;

    const never = stripPhrases(withoutBullet, NEVER_SUBSTITUTE);
    const anyBrand = stripPhrases(never.text, ANY_BRAND);
    const optional = stripPhrases(anyBrand.text, OPTIONAL);

    const { quantity, text, source } = extractQuantity(optional.text);
    if (text.length === 0) {
      warnings.push(`empty_line_after_parsing:${rawLine}`);
      continue;
    }

    items.push({
      rawText: text,
      quantity,
      preferredBrand: null,
      substitutionPolicy: never.matched ? 'never' : 'allow',
      isLocked: never.matched,
      isOptional: optional.matched,
      quantitySource: source,
    });
  }

  if (items.length === 0 && input.trim().length > 0) warnings.push('no_items_recognised');
  return { items, warnings };
}

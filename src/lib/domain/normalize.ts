/**
 * Product normalisation and matching.
 *
 * Goal: "Milk 3% 1L" and "חלב טרי 3% 1 ליטר" resolve to one normalised product,
 * while "Milk 3% 2L" stays a different package. Barcode wins whenever present;
 * otherwise we build a deterministic signature from brand + canonical terms +
 * package size, and score candidates by token overlap.
 */

import { parsePackageSize, type PackageSize } from './units';

const HEBREW_DIACRITICS = /[֑-ׇ]/g;
const PUNCTUATION = /[.,;:!?()[\]{}<>/\\|_"'`׳״+*=&@#~^-]/g;

/**
 * Unit words are dropped from the token set: package size is parsed separately
 * and compared structurally, so leaving "1l" / "1000ml" in the tokens would make
 * two spellings of the same package look like different products.
 */
const UNIT_WORDS = new Set([
  'g', 'gr', 'gram', 'grams', 'kg', 'kgs', 'mg', 'ml', 'mls', 'l', 'lt', 'ltr', 'liter', 'litre', 'liters', 'cc',
  'unit', 'units', 'pc', 'pcs', 'piece', 'pieces', 'x', 'pack', 'packs',
  'גרם', 'גר', 'קג', 'קילו', 'קילוגרם', 'ליטר', 'מל', 'מיליליטר', 'יח', 'יחידה', 'יחידות', 'מארז',
]);

/** Words that carry no identity and only add noise to matching. */
const STOPWORDS = new Set([
  'the', 'a', 'of', 'and', 'with', 'in', 'for', 'fresh', 'new', 'premium',
  'של', 'עם', 'ב', 'ל', 'ה', 'מ', 'את', 'טרי', 'טרייה', 'חדש', 'מהדרין',
]);

/** Cross-language canonical terms: any listed spelling maps to the canonical key. */
const CANONICAL_TERMS: Record<string, readonly string[]> = {
  milk: ['milk', 'חלב'],
  egg: ['egg', 'eggs', 'ביצים', 'ביצה'],
  bread: ['bread', 'לחם'],
  coffee: ['coffee', 'קפה'],
  rice: ['rice', 'אורז'],
  chicken: ['chicken', 'עוף'],
  cereal: ['cereal', 'cornflakes', 'דגני', 'קורנפלקס', 'פתיתים'],
  shampoo: ['shampoo', 'שמפו'],
  'toilet-paper': ['toilet', 'נייר', 'טואלט'],
  yogurt: ['yogurt', 'yoghurt', 'יוגורט'],
  cheese: ['cheese', 'גבינה'],
  butter: ['butter', 'חמאה'],
  oil: ['oil', 'שמן'],
  sugar: ['sugar', 'סוכר'],
  flour: ['flour', 'קמח'],
  pasta: ['pasta', 'spaghetti', 'פסטה', 'ספגטי'],
  tomato: ['tomato', 'tomatoes', 'עגבניה', 'עגבניות'],
  cucumber: ['cucumber', 'cucumbers', 'מלפפון', 'מלפפונים'],
  cola: ['cola', 'coca', 'קולה', 'קוקה'],
  water: ['water', 'מים'],
  tuna: ['tuna', 'טונה'],
  hummus: ['hummus', 'חומוס'],
  tehina: ['tehina', 'tahini', 'טחינה'],
};

const TERM_LOOKUP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, spellings] of Object.entries(CANONICAL_TERMS)) {
    for (const spelling of spellings) map.set(spelling, canonical);
  }
  return map;
})();

/** Lowercases, strips diacritics and punctuation, and collapses whitespace. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(HEBREW_DIACRITICS, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    // "3 percent" and "3 אחוז" are the same claim as "3%".
    .replace(/(\d+)\s*(?:percent|אחוז)\b/g, '$1%');
}

/** True for tokens that only restate the package size, which is compared structurally. */
function isSizeToken(token: string): boolean {
  if (UNIT_WORDS.has(token)) return true;
  // A leading digit means a quantity ("200g", "1l", "6"); a percentage is kept
  // because fat content and concentration are part of product identity.
  return /^\d/.test(token) && !token.endsWith('%');
}

/** Tokenises a product name into meaningful, canonicalised terms. */
export function tokenize(input: string): string[] {
  const tokens = normalizeText(input)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t) && !isSizeToken(t));
  return tokens.map((t) => TERM_LOOKUP.get(t) ?? t);
}

export interface NormalizedProduct {
  /** Stable identity key, derived from barcode when available. */
  signature: string;
  barcode: string | null;
  brand: string | null;
  canonicalName: string;
  category: string | null;
  size: PackageSize | null;
  tokens: string[];
}

export interface RawProductInput {
  name: string;
  barcode?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  /** Explicit size, when the source provides structured fields. */
  size?: PackageSize | null;
}

/** Israeli retail barcodes are EAN-8/EAN-13/UPC-A; anything else is not trusted as an identity. */
export function isPlausibleBarcode(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length === 8 || digits.length === 12 || digits.length === 13;
}

export function normalizeProduct(input: RawProductInput): NormalizedProduct {
  const barcode = isPlausibleBarcode(input.barcode) ? input.barcode!.replace(/\D/g, '') : null;
  const size = input.size ?? parsePackageSize(input.name);
  const brandSource = input.brand ?? input.manufacturer ?? null;
  const brand = brandSource ? normalizeText(brandSource) : null;
  const tokens = tokenize(input.name);
  const canonicalName = tokens.join(' ');

  const sizeKey = size ? `${size.baseQuantity}${size.baseUnit}` : 'nosize';
  const signature = barcode
    ? `barcode:${barcode}`
    : `sig:${brand ?? 'nobrand'}|${[...tokens].sort().join('-')}|${sizeKey}`;

  return {
    signature,
    barcode,
    brand,
    canonicalName,
    category: input.category ? normalizeText(input.category) : null,
    size,
    tokens,
  };
}

export interface MatchScore {
  score: number; // 0..1
  reason: 'barcode' | 'signature' | 'tokens' | 'none';
  /** False when the two products are different package sizes of the same item. */
  samePackage: boolean;
}

/**
 * Scores how likely two normalised products are the same purchasable item.
 * A different package size caps the score: it is a related product, not the same one.
 */
export function scoreMatch(a: NormalizedProduct, b: NormalizedProduct): MatchScore {
  const sameSize =
    a.size === null || b.size === null
      ? a.size === b.size
      : a.size.baseUnit === b.size.baseUnit && a.size.baseQuantity === b.size.baseQuantity;

  if (a.barcode && b.barcode) {
    return { score: a.barcode === b.barcode ? 1 : 0, reason: 'barcode', samePackage: a.barcode === b.barcode };
  }
  if (a.signature === b.signature) {
    return { score: 0.95, reason: 'signature', samePackage: true };
  }

  const setA = new Set(a.tokens);
  const setB = new Set(b.tokens);
  if (setA.size === 0 || setB.size === 0) return { score: 0, reason: 'none', samePackage: false };
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  const brandBonus = a.brand && b.brand && a.brand === b.brand ? 0.1 : 0;
  const raw = Math.min(1, jaccard + brandBonus);
  // Different package sizes must never reach "same product" confidence.
  const score = sameSize ? raw : Math.min(raw, 0.5);
  return { score, reason: score > 0 ? 'tokens' : 'none', samePackage: sameSize && score >= 0.6 };
}

export const MATCH_ACCEPT_THRESHOLD = 0.62;

export interface MatchCandidate<T> {
  item: T;
  normalized: NormalizedProduct;
}

export interface MatchOutcome<T> {
  best: MatchCandidate<T> | null;
  score: MatchScore;
  accepted: boolean;
  /** Runners-up, useful for showing the user alternatives instead of guessing. */
  alternatives: Array<{ item: T; score: number }>;
}

export function findBestMatch<T>(
  query: NormalizedProduct,
  candidates: ReadonlyArray<MatchCandidate<T>>,
  threshold = MATCH_ACCEPT_THRESHOLD,
): MatchOutcome<T> {
  let best: MatchCandidate<T> | null = null;
  let bestScore: MatchScore = { score: 0, reason: 'none', samePackage: false };
  const scored: Array<{ item: T; score: number }> = [];

  for (const candidate of candidates) {
    const score = scoreMatch(query, candidate.normalized);
    scored.push({ item: candidate.item, score: score.score });
    if (score.score > bestScore.score) {
      best = candidate;
      bestScore = score;
    }
  }

  scored.sort((x, y) => y.score - x.score);
  return {
    best,
    score: bestScore,
    accepted: best !== null && bestScore.score >= threshold,
    alternatives: scored.slice(1, 5).filter((s) => s.score > 0),
  };
}

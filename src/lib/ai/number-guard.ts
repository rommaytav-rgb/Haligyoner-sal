/**
 * Guard against invented numbers in generated text.
 *
 * The product rule is absolute: the AI may phrase an explanation, but every
 * figure in it must have been computed by the deterministic engines. This module
 * extracts the numbers from a generated sentence and checks each one against the
 * set of facts the model was given. Anything else means the text is discarded
 * and the deterministic template is used instead.
 */

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

/** Numbers within this absolute distance are treated as the same figure. */
const TOLERANCE = 0.051;

/**
 * Reads the numbers out of a sentence.
 *
 * A leading hyphen only counts as a minus sign when it opens a token. Hebrew
 * attaches prefixes with a maqaf — "ב-14" means "by 14", not "by minus 14" — so
 * a hyphen glued to a preceding letter is punctuation, not a sign.
 */
export function extractNumbers(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const index = match.index ?? 0;
    const raw = match[0];
    const before = index > 0 ? text[index - 1] : '';
    const beforeThat = index > 1 ? text[index - 2] : '';
    const isSign =
      (before === '-' || before === '\u2212') && (index === 1 || /[\s([{]/.test(beforeThat ?? ''));
    const value = Number.parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    values.push(isSign ? -value : value);
  }
  return values;
}

/**
 * Collects every number a model is allowed to restate, including the forms a
 * writer would naturally use: the value itself, its absolute value, and its
 * rounded shekel form for agorot amounts.
 */
export function allowedNumbersFrom(facts: Record<string, unknown>): Set<number> {
  const allowed = new Set<number>();
  const add = (value: number) => {
    if (!Number.isFinite(value)) return;
    allowed.add(value);
    allowed.add(Math.abs(value));
    allowed.add(Math.round(value));
    allowed.add(Math.abs(Math.round(value)));
  };

  const walk = (value: unknown, key: string): void => {
    if (typeof value === 'number') {
      add(value);
      // Money is carried in agorot; a writer will quote it in shekels.
      if (/agorot$/i.test(key)) {
        add(value / 100);
        add(Math.abs(value / 100));
        add(Math.round(value / 100));
        add(Math.abs(Math.round(value / 100)));
        add(Math.round((value / 100) * 10) / 10);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry, key);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) walk(childValue, childKey);
    }
  };

  walk(facts, 'root');
  // Small integers are unavoidable in ordinary prose ("two of the products").
  for (const small of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) allowed.add(small);
  return allowed;
}

export interface NumberCheck {
  ok: boolean;
  offending: number[];
}

export function checkNumbers(text: string, allowed: ReadonlySet<number>): NumberCheck {
  const offending: number[] = [];
  for (const value of extractNumbers(text)) {
    let matched = false;
    for (const candidate of allowed) {
      if (Math.abs(candidate - value) <= TOLERANCE) {
        matched = true;
        break;
      }
    }
    if (!matched) offending.push(value);
  }
  return { ok: offending.length === 0, offending };
}

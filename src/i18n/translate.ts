import type { Dictionary, TranslationParams } from "./types";

/**
 * Resolves a dotted key against a dictionary and fills {placeholders}.
 *
 * A missing key returns the key itself rather than throwing: a translation gap
 * should never take a page down. The typed dictionary makes such gaps a build
 * error in practice, so this is a runtime safety net, not the mechanism.
 */
export function translate(dictionary: Dictionary, key: string, params?: TranslationParams): string {
  const value = resolve(dictionary, key);
  if (typeof value !== "string") return key;
  return params ? fill(value, params) : value;
}

function resolve(dictionary: Dictionary, key: string): unknown {
  let current: unknown = dictionary;
  for (const segment of key.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function fill(template: string, params: TranslationParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Reads a list-valued entry, such as the rotating composer examples. */
export function translateList(dictionary: Dictionary, key: string): readonly string[] {
  const value = resolve(dictionary, key);
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Selects the right plural form for a count.
 *
 * Hebrew inflects differently from English, so counted strings are stored as
 * `key_one` / `key_other` (plus `_two` / `_many` where a language needs them)
 * and chosen through Intl rather than by appending "(s)".
 */
export function translatePlural(
  dictionary: Dictionary,
  localeTag: string,
  key: string,
  count: number,
  params?: TranslationParams,
): string {
  const category = pluralCategory(localeTag, count);
  const merged = { count, ...params };

  for (const suffix of [category, "other", "one"]) {
    const candidate = resolve(dictionary, `${key}_${suffix}`);
    if (typeof candidate === "string") return fill(candidate, merged);
  }
  // No plural forms defined; fall back to the plain key.
  return translate(dictionary, key, merged);
}

function pluralCategory(localeTag: string, count: number): string {
  try {
    return new Intl.PluralRules(localeTag).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
}

/**
 * Resolves parameters that are themselves catalogue references.
 *
 * A stored system message may need to name something that is itself
 * translatable - a case status, say. Such a parameter is written as "@key" and
 * resolved here. The convention is deliberately explicit and used only for
 * system-authored text, so user content starting with "@" is never mistaken
 * for a reference.
 */
export function resolveRefs(
  dictionary: Dictionary,
  params: TranslationParams | undefined,
): TranslationParams | undefined {
  if (!params) return params;
  const out: TranslationParams = {};
  for (const [name, value] of Object.entries(params)) {
    out[name] = typeof value === "string" && value.startsWith("@") ? translate(dictionary, value.slice(1)) : value;
  }
  return out;
}

export interface Translator {
  (key: string, params?: TranslationParams): string;
  plural: (key: string, count: number, params?: TranslationParams) => string;
  list: (key: string) => readonly string[];
  /** Like calling the translator directly, but resolves "@key" parameters. */
  ref: (key: string, params?: TranslationParams, count?: number) => string;
}

export function makeTranslator(dictionary: Dictionary, localeTag: string): Translator {
  const t = ((key: string, params?: TranslationParams) => translate(dictionary, key, params)) as Translator;
  t.plural = (key, count, params) => translatePlural(dictionary, localeTag, key, count, params);
  t.list = (key) => translateList(dictionary, key);
  t.ref = (key, params, count) => {
    const resolved = resolveRefs(dictionary, params);
    return count === undefined
      ? translate(dictionary, key, resolved)
      : translatePlural(dictionary, localeTag, key, count, resolved);
  };
  return t;
}

import { en } from "./locales/en";
import { he } from "./locales/he";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { Dictionary } from "./types";

const DICTIONARIES: Record<Locale, Dictionary> = { en, he };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export * from "./config";
export * from "./translate";
export type { Dictionary, TranslationParams } from "./types";

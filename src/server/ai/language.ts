import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

/**
 * Detects the language a person actually wrote in.
 *
 * This decides the language of the *case* - its title, questions, replies and
 * drafts - which is deliberately independent of the interface language. Someone
 * browsing in English can still open a case in Hebrew, and it stays Hebrew.
 */
const HEBREW_BLOCK = /[֐-׿יִ-ﭏ]/;

export function detectLanguage(text: string, fallback: Locale = DEFAULT_LOCALE): Locale {
  const letters = [...text].filter((ch) => /\p{L}/u.test(ch));
  if (letters.length === 0) return fallback;

  const hebrew = letters.filter((ch) => HEBREW_BLOCK.test(ch)).length;
  // A single borrowed word shouldn't flip the language, but a genuinely Hebrew
  // sentence usually carries well over a fifth of its letters in Hebrew script.
  return hebrew / letters.length >= 0.2 ? "he" : "en";
}

/** Reads the language stored on a case, falling back safely. */
export function caseLocale(value: string | undefined, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(value) ? value : fallback;
}

/** The name of a language, for instructing a model which one to reply in. */
export const LANGUAGE_NAME: Record<Locale, string> = {
  en: "English",
  he: "Hebrew",
};

/**
 * Translation and locale handling.
 *
 * There are no hardcoded user-facing strings anywhere in the UI: every one goes
 * through `t()`. Hebrew is the default and renders right-to-left.
 */

import { en, type Dictionary, type TranslationKey } from './en';
import { he } from './he';

export type Locale = 'he' | 'en';
export const LOCALES: Locale[] = ['he', 'en'];
export const DEFAULT_LOCALE: Locale = 'he';
export const LOCALE_COOKIE = 'pso_locale';

const DICTIONARIES: Record<Locale, Dictionary> = { he, en };

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'he' || value === 'en';
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

export function htmlLang(locale: Locale): string {
  return locale === 'he' ? 'he' : 'en';
}

/**
 * Looks up a key and substitutes `{placeholders}`.
 * A missing key returns the key itself, which makes gaps obvious in review
 * rather than silently rendering English into a Hebrew page.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const template = dictionary[key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export type Translator = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function createTranslator(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}

/** Formats a date for display in the given locale. */
export function formatDate(iso: string, locale: Locale): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

export function formatShortDate(iso: string, locale: Locale): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(ms));
}

/** Signed percentage with one decimal place, e.g. "+29.2%" / "−16.7%". */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0%';
  const sign = rounded > 0 ? '+' : '−';
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

export { en, he };
export type { TranslationKey, Dictionary };

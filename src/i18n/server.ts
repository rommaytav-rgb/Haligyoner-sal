import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_TAG,
  directionOf,
  isLocale,
  localeFromAcceptLanguage,
  type Direction,
  type Locale,
} from "./config";
import { getDictionary } from "./index";
import { makeTranslator, type Translator } from "./translate";
import type { Dictionary } from "./types";

/**
 * Resolves the interface language for the current request: an explicit choice
 * first, then the browser's preference, then English.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const accept = (await headers()).get("accept-language");
  return localeFromAcceptLanguage(accept) ?? DEFAULT_LOCALE;
}

export interface ServerI18n {
  locale: Locale;
  direction: Direction;
  dictionary: Dictionary;
  t: Translator;
}

/** Everything a server component needs to render in the visitor's language. */
export async function getI18n(): Promise<ServerI18n> {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  return {
    locale,
    direction: directionOf(locale),
    dictionary,
    t: makeTranslator(dictionary, LOCALE_TAG[locale]),
  };
}

/** For API routes, which need the same messages without the rest. */
export async function getRequestTranslator(): Promise<Translator> {
  const locale = await getLocale();
  return makeTranslator(getDictionary(locale), LOCALE_TAG[locale]);
}

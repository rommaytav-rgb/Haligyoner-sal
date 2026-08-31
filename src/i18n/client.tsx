"use client";

import * as React from "react";
import { LOCALE_TAG, directionOf, type Direction, type Locale } from "./config";
import { makeTranslator, type Translator } from "./translate";
import { relativeTime as formatRelativeTime } from "./format";
import type { Dictionary } from "./types";

interface I18nValue {
  locale: Locale;
  direction: Direction;
  t: Translator;
  /** Locale-aware relative time, so client components don't re-derive it. */
  relativeTime: (iso: string) => string;
}

const I18nContext = React.createContext<I18nValue | null>(null);

/**
 * Carries the active language into client components. The dictionary is
 * resolved on the server and handed down, so only the chosen language crosses
 * the wire rather than every translation the product has.
 */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = React.useMemo<I18nValue>(
    () => ({
      locale,
      direction: directionOf(locale),
      t: makeTranslator(dictionary, LOCALE_TAG[locale]),
      relativeTime: (iso: string) => formatRelativeTime(iso, locale),
    }),
    [locale, dictionary],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = React.useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside an I18nProvider.");
  return value;
}

/** Shorthand for the common case of only needing the translator. */
export function useT(): Translator {
  return useI18n().t;
}

/**
 * Locale configuration.
 *
 * Two languages are first-class from the start: English (LTR) and Hebrew (RTL).
 * Nothing about the product assumes one is the "real" language and the other a
 * translation layer.
 */

export const LOCALES = ["en", "he"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "fmp_locale";

export type Direction = "ltr" | "rtl";

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  en: "ltr",
  he: "rtl",
};

/** How each language names itself, for the switcher. */
export const LOCALE_NAME: Record<Locale, string> = {
  en: "English",
  he: "עברית",
};

/** Short label used in the compact switcher. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  he: "עב",
};

/** BCP-47 tag for Intl formatting. */
export const LOCALE_TAG: Record<Locale, string> = {
  en: "en-GB",
  he: "he-IL",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): Direction {
  return LOCALE_DIRECTION[locale];
}

/**
 * Picks the best supported locale from an Accept-Language header. Used only
 * when the visitor has not chosen a language yet.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    // "iw" is the legacy ISO code for Hebrew and still appears in the wild.
    if (base === "he" || base === "iw") return "he";
    if (base === "en") return "en";
  }
  return null;
}

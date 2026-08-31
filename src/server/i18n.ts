import { getDictionary } from "@/i18n";
import { DEFAULT_LOCALE, LOCALE_TAG, type Locale } from "@/i18n/config";
import { makeTranslator, type Translator } from "@/i18n/translate";
import { systemText } from "@/i18n/system-text";
import type { LocalizedText } from "@/domain/types";

/**
 * Server-side helpers for text the system records against a case.
 *
 * A recorded entry stores both a catalogue reference and a rendered fallback.
 * The reference is what the interface displays, so the entry reads in whichever
 * language the reader has chosen; the fallback keeps the stored record legible
 * on its own, in logs or exports.
 */
const translators = new Map<Locale, Translator>();

function translatorFor(locale: Locale): Translator {
  let translator = translators.get(locale);
  if (!translator) {
    translator = makeTranslator(getDictionary(locale), LOCALE_TAG[locale]);
    translators.set(locale, translator);
  }
  return translator;
}

const fallbackTranslator = translatorFor(DEFAULT_LOCALE);

/**
 * Renders catalogue text in the language a *case* was written in.
 *
 * Case content - a plan step, a disclaimer attached to a reply - has to match
 * the language of the case itself, not the language the reader happens to have
 * the interface set to.
 */
export function caseText(
  key: string,
  params?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
  count?: number,
): string {
  return translatorFor(locale).ref(key, params, count);
}

export type Recordable = string | LocalizedText;

export interface ResolvedRecord {
  text: string;
  ref?: LocalizedText;
}

/** Renders a value for storage, keeping its catalogue reference when it has one. */
export function resolveRecord(value: Recordable): ResolvedRecord {
  if (typeof value === "string") return { text: value };
  return { text: fallbackTranslator.ref(value.key, value.params, value.count), ref: value };
}

export { systemText };

/** Builds a reference to a status name, for embedding in a system message. */
export function statusRef(status: string): string {
  return `@status.${status}`;
}

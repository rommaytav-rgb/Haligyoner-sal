import type { LocalizedText } from "@/domain/types";
import type { Translator } from "./translate";

/**
 * Renders a stored case entry.
 *
 * System-generated entries carry a catalogue key and render in the reader's
 * language. Entries holding user, document or model content carry no key and
 * are shown exactly as recorded - translating those would rewrite the case.
 */
export function renderSystemText(t: Translator, localized: LocalizedText | undefined, fallback: string): string {
  if (!localized) return fallback;
  return t.ref(localized.key, localized.params, localized.count);
}

/** Convenience for building a stored reference at the point it is recorded. */
export function systemText(
  key: string,
  params?: Record<string, string | number>,
  count?: number,
): LocalizedText {
  return count === undefined ? { key, params } : { key, params, count };
}

import type { en } from "./locales/en";

/**
 * Widens the English catalogue's literal types into plain strings, at any
 * nesting depth, so other locales can be typed against its exact shape.
 */
type Translatable<T> = T extends readonly string[]
  ? readonly string[]
  : T extends string
    ? string
    : { readonly [K in keyof T]: Translatable<T[K]> };

/**
 * The English catalogue defines the contract. Every other locale is typed
 * against it, so a missing or misspelled key fails the build rather than
 * showing up as an untranslated gap in the interface.
 */
export type Dictionary = Translatable<typeof en>;

export type TranslationParams = Record<string, string | number>;

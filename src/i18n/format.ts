import { LOCALE_TAG, type Locale } from "./config";
import type { Dictionary } from "./types";
import { translate } from "./translate";

/**
 * Locale-aware formatting. Relative times and dates go through Intl rather
 * than hand-written English strings, so Hebrew gets correct grammar and
 * numerals without a parallel implementation.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, locale: Locale, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const tag = LOCALE_TAG[locale];
  const diff = then - now.getTime();
  const abs = Math.abs(diff);

  const formatter = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });

  if (abs < MINUTE) return formatter.format(0, "second");
  if (abs < HOUR) return formatter.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return formatter.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return formatter.format(Math.round(diff / DAY), "day");

  return new Date(iso).toLocaleDateString(tag, { year: "numeric", month: "short", day: "numeric" });
}

export function greetingKey(date: Date = new Date()): "home.greetingMorning" | "home.greetingAfternoon" | "home.greetingEvening" {
  const hour = date.getHours();
  if (hour < 5) return "home.greetingEvening";
  if (hour < 12) return "home.greetingMorning";
  if (hour < 18) return "home.greetingAfternoon";
  return "home.greetingEvening";
}

export function greeting(dictionary: Dictionary, date: Date = new Date()): string {
  return translate(dictionary, greetingKey(date));
}

export function formatBytes(bytes: number, locale: Locale): string {
  const tag = LOCALE_TAG[locale];
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(tag, { maximumFractionDigits: digits }).format(value);

  if (bytes < 1024) return `${number(bytes)} B`;
  if (bytes < 1024 * 1024) return `${number(bytes / 1024)} KB`;
  return `${number(bytes / (1024 * 1024), 1)} MB`;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(value);
}

/** Initials work from the display name or the local part of an email. */
export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.split("@")[0] ?? "";
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

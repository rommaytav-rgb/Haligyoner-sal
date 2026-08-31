import type { TranslationParams } from "@/i18n/types";
import type { Translator } from "@/i18n/translate";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "CAPABILITY_UNAVAILABLE"
  | "UPSTREAM_FAILED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  CAPABILITY_UNAVAILABLE: 501,
  UPSTREAM_FAILED: 502,
  INTERNAL: 500,
};

/**
 * Errors carry a catalogue key rather than a sentence, so the message reaches
 * the user in their own language. Stack traces never leave the server; the key
 * doubles as a stable identifier in the logs.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly params?: TranslationParams;
  readonly details?: unknown;

  constructor(code: ErrorCode, messageKey: string, params?: TranslationParams, details?: unknown) {
    super(messageKey);
    this.name = "AppError";
    this.code = code;
    this.messageKey = messageKey;
    this.params = params;
    this.details = details;
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export const unauthenticated = (key = "errors.unauthenticated") => new AppError("UNAUTHENTICATED", key);
export const forbidden = (key = "errors.forbidden") => new AppError("FORBIDDEN", key);
export const notFound = (key = "errors.notFound") => new AppError("NOT_FOUND", key);
export const invalid = (key: string, params?: TranslationParams) => new AppError("INVALID_INPUT", key, params);
export const conflict = (key: string, params?: TranslationParams) => new AppError("CONFLICT", key, params);
export const unavailable = (key: string) => new AppError("CAPABILITY_UNAVAILABLE", key);
export const upstreamFailed = (key: string) => new AppError("UPSTREAM_FAILED", key);

export function statusFor(err: unknown): number {
  return err instanceof AppError ? err.status : 500;
}

/** Renders an error for the user in the language of the current request. */
export function userMessageFor(err: unknown, t: Translator): string {
  if (err instanceof AppError) return t.ref(err.messageKey, err.params);
  return t("errors.generic");
}

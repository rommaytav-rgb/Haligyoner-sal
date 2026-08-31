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

/** Messages carried by AppError are written for users; stack traces never leave the server (§39). */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export const unauthenticated = (m = "Please sign in to continue.") => new AppError("UNAUTHENTICATED", m);
export const forbidden = (m = "You don't have access to this.") => new AppError("FORBIDDEN", m);
export const notFound = (m = "We couldn't find that.") => new AppError("NOT_FOUND", m);
export const invalid = (m: string, details?: unknown) => new AppError("INVALID_INPUT", m, details);
export const unavailable = (m: string) => new AppError("CAPABILITY_UNAVAILABLE", m);

export function statusFor(err: unknown): number {
  return err instanceof AppError ? err.status : 500;
}

export function userMessageFor(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return "Something went wrong on our side. Nothing was lost — please try again.";
}

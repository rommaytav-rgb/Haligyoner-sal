/**
 * Fixed-window rate limiting, held in process memory.
 *
 * Adequate for a single Cloud Run instance and for keeping a runaway client
 * from burning model spend. A shared store (Redis/Memorystore) is the next step
 * when the service runs multi-instance; the call sites do not change.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 15 * 60_000 },
  caseCreate: { limit: 20, windowMs: 60 * 60_000 },
  message: { limit: 60, windowMs: 60 * 60_000 },
  upload: { limit: 40, windowMs: 60 * 60_000 },
  read: { limit: 600, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  windows.clear();
}

/** Prunes expired windows so the map cannot grow without bound. */
export function sweepRateLimits(now = Date.now()): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

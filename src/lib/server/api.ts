/**
 * Route-handler helpers: JSON responses, request validation and rate limiting.
 */

import { NextResponse } from 'next/server';
import type { z } from 'zod';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as unknown as Record<string, unknown>, init);
}

export function fail(code: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ error: code, details: details ?? null }, { status });
}

export const unauthorized = () => fail('unauthorized', 401);
export const notFound = () => fail('not_found', 404);

/** Parses and validates a JSON body, returning a typed value or an error response. */
export async function readJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { data: null, error: fail('invalid_json', 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { data: null, error: fail('validation_failed', 422, parsed.error.issues) };
  }
  return { data: parsed.data, error: null };
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window rate limiter, per key, in process memory.
 *
 * Adequate for a single-instance deployment; a multi-instance deployment should
 * back this with a shared store. Sign-in and AI-backed endpoints are the ones
 * that need it most.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export function clientKey(request: Request, scope: string): string {
  // Behind a proxy the first forwarded address is the closest thing to a client id.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${scope}:${forwarded || 'local'}`;
}

export function tooManyRequests(retryAfterMs: number): NextResponse {
  return NextResponse.json(
    { error: 'rate_limited', details: null },
    { status: 429, headers: { 'retry-after': String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

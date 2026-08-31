import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession, pruneExpiredSessions, SESSION_COOKIE } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { authenticate, InvalidCredentialsError } from '@/lib/services/users';
import { clientKey, fail, ok, rateLimit, readJson, tooManyRequests } from '@/lib/server/api';
import { sessionCookieOptions } from '@/lib/server/context';

const Body = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(400) });

export async function POST(request: Request): Promise<Response> {
  // Brute-force protection: a handful of attempts per minute per client.
  const limit = rateLimit(clientKey(request, 'sign-in'), 10, 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterMs);

  const { data, error } = await readJson(request, Body);
  if (error) return error;

  const db = getDb();
  try {
    const user = await authenticate(db, data.email, data.password);
    pruneExpiredSessions(db);
    const { token } = createSession(db, user.id);
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
    return ok({ user: { id: user.id, email: user.email } });
  } catch (caught) {
    if (caught instanceof InvalidCredentialsError) return fail('invalid_credentials', 401);
    throw caught;
  }
}

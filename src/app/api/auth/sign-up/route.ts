import { cookies } from 'next/headers';
import { z } from 'zod';
import { createSession } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { WeakPasswordError } from '@/lib/auth/passwords';
import { createUser, EmailInUseError, InvalidCredentialsError } from '@/lib/services/users';
import { createBasket } from '@/lib/services/baskets';
import { clientKey, fail, ok, rateLimit, readJson, tooManyRequests } from '@/lib/server/api';
import { sessionCookieOptions } from '@/lib/server/context';

const Body = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(400),
  displayName: z.string().max(80).optional(),
  locale: z.enum(['he', 'en']).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const limit = rateLimit(clientKey(request, 'sign-up'), 5, 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterMs);

  const { data, error } = await readJson(request, Body);
  if (error) return error;

  const db = getDb();
  try {
    const user = await createUser(db, data);
    // A new account always starts with a basket, so the first screen has somewhere to go.
    createBasket(db, user.id, data.locale === 'en' ? 'My weekly basket' : 'הסל השבועי שלי');
    const { token } = createSession(db, user.id);
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
    return ok({ user: { id: user.id, email: user.email } }, { status: 201 });
  } catch (caught) {
    if (caught instanceof EmailInUseError) return fail('email_in_use', 409);
    if (caught instanceof WeakPasswordError) return fail('weak_password', 422);
    if (caught instanceof InvalidCredentialsError) return fail('invalid_email', 422);
    throw caught;
  }
}

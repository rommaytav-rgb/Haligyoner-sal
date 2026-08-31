import { cookies } from 'next/headers';
import { destroySession, SESSION_COOKIE } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ok } from '@/lib/server/api';

export async function POST(): Promise<Response> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) destroySession(getDb(), token);
  store.delete(SESSION_COOKIE);
  return ok({ signedOut: true });
}

/**
 * Request context helpers for server components and route handlers.
 *
 * Every authenticated read and write goes through `requireUser`, which resolves
 * the session cookie to a user. Nothing in the UI ever passes a user id from the
 * client.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from '@/lib/db/client';
import { resolveSession, SESSION_COOKIE, type SessionUser } from '@/lib/auth/session';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n';

export interface RequestContext {
  db: DatabaseSync;
  user: SessionUser | null;
  locale: Locale;
}

export async function getContext(): Promise<RequestContext> {
  const store = await cookies();
  const db = getDb();
  const user = resolveSession(db, store.get(SESSION_COOKIE)?.value);
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  // An explicit cookie wins; otherwise the account's own preference; otherwise Hebrew.
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : (user?.locale ?? DEFAULT_LOCALE);
  return { db, user, locale };
}

export async function requireUser(): Promise<RequestContext & { user: SessionUser }> {
  const context = await getContext();
  if (!context.user) redirect('/sign-in');
  return context as RequestContext & { user: SessionUser };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

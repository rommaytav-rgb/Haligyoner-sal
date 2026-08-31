/**
 * Session management: server-side sessions keyed by an opaque random id stored
 * in an httpOnly cookie. Nothing about the user is encoded in the cookie, so a
 * stolen cookie can be revoked by deleting the row.
 */

import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { all, get, newId, nowIso, optStr, run, str, type Row } from '@/lib/db/client';

export const SESSION_COOKIE = 'pso_session';
export const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  locale: 'he' | 'en';
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function createSession(db: DatabaseSync, userId: string): { token: string; expiresAt: string } {
  const token = createSessionToken();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  run(db, 'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
    token,
    userId,
    createdAt,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export function resolveSession(db: DatabaseSync, token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const row = get<Row>(
    db,
    `SELECT u.id AS id, u.email AS email, u.display_name AS display_name, u.locale AS locale, s.expires_at AS expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
    [token],
  );
  if (!row) return null;
  if (typeof row.expires_at === 'string' && Date.parse(row.expires_at) < Date.now()) {
    destroySession(db, token);
    return null;
  }
  return {
    id: str(row.id),
    email: str(row.email),
    displayName: optStr(row.display_name),
    locale: row.locale === 'en' ? 'en' : 'he',
  };
}

export function destroySession(db: DatabaseSync, token: string): void {
  run(db, 'DELETE FROM sessions WHERE id = ?', [token]);
}

export function destroyAllSessions(db: DatabaseSync, userId: string): void {
  run(db, 'DELETE FROM sessions WHERE user_id = ?', [userId]);
}

/** Removes expired rows. Called opportunistically on login. */
export function pruneExpiredSessions(db: DatabaseSync): number {
  const expired = all<Row>(db, 'SELECT id FROM sessions WHERE expires_at < ?', [nowIso()]);
  for (const row of expired) destroySession(db, str(row.id));
  return expired.length;
}

export { newId };

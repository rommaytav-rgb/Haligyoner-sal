/**
 * Password hashing with scrypt from Node's crypto module.
 *
 * Format: `scrypt$N$r$p$<salt-b64>$<hash-b64>`. The parameters are stored with
 * the hash so they can be raised later without invalidating existing users.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 64 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 10;

export class WeakPasswordError extends Error {}

export function assertPasswordStrength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordStrength(password);
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] as string, 'base64');
  const expected = Buffer.from(parts[5] as string, 'base64');
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: MAXMEM,
  });
  // Constant-time comparison so a wrong password cannot be probed by timing.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createMemoryDb } from '@/lib/db/client';
import {
  authenticate,
  createUser,
  deleteUser,
  EmailInUseError,
  exportUserData,
  getPreferences,
  InvalidCredentialsError,
  listMemberships,
  normalizeEmail,
  setMembership,
  updatePreferences,
} from './users';

let db: DatabaseSync;

beforeEach(() => {
  db = createMemoryDb();
});

describe('createUser', () => {
  it('normalises the email and creates default preferences', async () => {
    const user = await createUser(db, { email: '  Shopper@Example.COM ', password: 'a-good-password' });
    expect(user.email).toBe('shopper@example.com');
    expect(getPreferences(db, user.id).optimizationMode).toBe('best_value');
  });

  it('rejects a duplicate email', async () => {
    await createUser(db, { email: 'a@example.com', password: 'a-good-password' });
    await expect(createUser(db, { email: 'A@example.com', password: 'another-password' })).rejects.toThrow(
      EmailInUseError,
    );
  });

  it('rejects an invalid email', async () => {
    await expect(createUser(db, { email: 'not-an-email', password: 'a-good-password' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});

describe('authenticate', () => {
  it('accepts the right password and rejects the wrong one', async () => {
    const user = await createUser(db, { email: 'a@example.com', password: 'a-good-password' });
    expect((await authenticate(db, 'A@Example.com', 'a-good-password')).id).toBe(user.id);
    await expect(authenticate(db, 'a@example.com', 'wrong')).rejects.toThrow(InvalidCredentialsError);
  });

  it('gives the same error for an unknown account as for a wrong password', async () => {
    await expect(authenticate(db, 'nobody@example.com', 'whatever-password')).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});

describe('preferences', () => {
  it('changes only the keys it is given', async () => {
    const user = await createUser(db, { email: 'a@example.com', password: 'a-good-password' });
    updatePreferences(db, user.id, { maxStores: 3, excludedChainIds: ['victory'], weeklyBudgetAgorot: 50_000 });
    updatePreferences(db, user.id, { maxDistanceKm: 8 });

    const preferences = getPreferences(db, user.id);
    expect(preferences.maxStores).toBe(3);
    expect(preferences.excludedChainIds).toEqual(['victory']);
    expect(preferences.weeklyBudgetAgorot).toBe(50_000);
    expect(preferences.maxDistanceKm).toBe(8);
  });

  it('round-trips list and object preferences', async () => {
    const user = await createUser(db, { email: 'a@example.com', password: 'a-good-password' });
    updatePreferences(db, user.id, {
      dislikedBrands: ['brand-a', 'brand-b'],
      severityThresholds: { minimal: 1, small: 3, moderate: 7, large: 15 },
    });
    const preferences = getPreferences(db, user.id);
    expect(preferences.dislikedBrands).toEqual(['brand-a', 'brand-b']);
    expect(preferences.severityThresholds).toEqual({ minimal: 1, small: 3, moderate: 7, large: 15 });
  });
});

describe('memberships', () => {
  it('adds and removes a membership', async () => {
    const user = await createUser(db, { email: 'a@example.com', password: 'a-good-password' });
    setMembership(db, user.id, 'shufersal', true);
    expect(listMemberships(db, user.id)).toEqual(['shufersal']);
    setMembership(db, user.id, 'shufersal', false);
    expect(listMemberships(db, user.id)).toEqual([]);
  });
});

describe('privacy', () => {
  it('exports the account’s own data', async () => {
    const user = await createUser(db, { email: 'a@example.com', password: 'a-good-password' });
    const exported = exportUserData(db, user.id) as Record<string, unknown[]>;
    expect(Object.keys(exported)).toContain('preferences');
    expect((exported.user as unknown[]).length).toBe(1);
  });

  it('deletes the account', async () => {
    const user = await createUser(db, { email: 'a@example.com', password: 'a-good-password' });
    deleteUser(db, user.id);
    await expect(authenticate(db, 'a@example.com', 'a-good-password')).rejects.toThrow(InvalidCredentialsError);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  A@B.COM ')).toBe('a@b.com');
  });
});

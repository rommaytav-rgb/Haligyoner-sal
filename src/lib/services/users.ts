/**
 * User accounts, preferences and memberships.
 *
 * Every read and write here is scoped by `userId`. No query in this file can
 * return another user's data, which is the isolation guarantee the rest of the
 * application relies on.
 */

import type { DatabaseSync } from 'node:sqlite';
import {
  all,
  fromBool,
  get,
  newId,
  nowIso,
  num,
  optNum,
  optStr,
  parseJson,
  run,
  str,
  toBool,
  type Row,
} from '@/lib/db/client';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';
import type { OptimizationMode } from '@/lib/domain/optimizer';
import type { SeverityThresholds } from '@/lib/domain/price-change';
import type { ConvenienceModel } from '@/lib/domain/optimizer';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  locale: 'he' | 'en';
  createdAt: string;
}

export interface UserPreferences {
  optimizationMode: OptimizationMode;
  maxStores: number;
  maxDistanceKm: number | null;
  city: string | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  householdSize: number | null;
  shoppingFrequencyDays: number | null;
  weeklyBudgetAgorot: number | null;
  wantsDelivery: boolean;
  allowSubstitutions: boolean;
  minSubstitutionScore: number;
  excludedChainIds: string[];
  preferredChainIds: string[];
  favoriteBrands: string[];
  dislikedBrands: string[];
  severityThresholds: SeverityThresholds;
  convenienceModel: ConvenienceModel;
}

export class EmailInUseError extends Error {}
export class InvalidCredentialsError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

function rowToUser(row: Row): UserRecord {
  return {
    id: str(row.id),
    email: str(row.email),
    displayName: optStr(row.display_name),
    locale: row.locale === 'en' ? 'en' : 'he',
    createdAt: str(row.created_at),
  };
}

export async function createUser(
  db: DatabaseSync,
  input: { email: string; password: string; displayName?: string | null; locale?: 'he' | 'en' },
): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new InvalidCredentialsError('invalid_email');
  const existing = get<Row>(db, 'SELECT id FROM users WHERE email = ?', [email]);
  if (existing) throw new EmailInUseError('email_in_use');

  const id = newId('usr');
  const now = nowIso();
  const passwordHash = await hashPassword(input.password);
  run(
    db,
    `INSERT INTO users (id, email, password_hash, display_name, locale, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, email, passwordHash, input.displayName ?? null, input.locale ?? 'he', now, now],
  );
  run(db, 'INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)', [id, now]);
  return { id, email, displayName: input.displayName ?? null, locale: input.locale ?? 'he', createdAt: now };
}

export async function authenticate(
  db: DatabaseSync,
  email: string,
  password: string,
): Promise<UserRecord> {
  const row = get<Row>(db, 'SELECT * FROM users WHERE email = ?', [normalizeEmail(email)]);
  if (!row) {
    // Spend comparable time on a missing user so account existence cannot be
    // probed by response timing.
    await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
    throw new InvalidCredentialsError('invalid_credentials');
  }
  const ok = await verifyPassword(password, String(row.password_hash));
  if (!ok) throw new InvalidCredentialsError('invalid_credentials');
  return rowToUser(row);
}

export function getUser(db: DatabaseSync, userId: string): UserRecord | null {
  const row = get<Row>(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  return row ? rowToUser(row) : null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  optimizationMode: 'best_value',
  maxStores: 2,
  maxDistanceKm: null,
  city: null,
  homeLatitude: null,
  homeLongitude: null,
  householdSize: null,
  shoppingFrequencyDays: 7,
  weeklyBudgetAgorot: null,
  wantsDelivery: false,
  allowSubstitutions: true,
  minSubstitutionScore: 0.65,
  excludedChainIds: [],
  preferredChainIds: [],
  favoriteBrands: [],
  dislikedBrands: [],
  severityThresholds: { minimal: 2, small: 5, moderate: 10, large: 20 },
  convenienceModel: { travelCostPerKmAgorot: 180, timeValuePerHourAgorot: 4000, extraStorePenaltyAgorot: 1200 },
};

export function getPreferences(db: DatabaseSync, userId: string): UserPreferences {
  const row = get<Row>(db, 'SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
  if (!row) return { ...DEFAULT_PREFERENCES };
  return {
    optimizationMode: (optStr(row.optimization_mode) as OptimizationMode | null) ?? 'best_value',
    maxStores: num(row.max_stores, 2),
    maxDistanceKm: optNum(row.max_distance_km),
    city: optStr(row.city),
    homeLatitude: optNum(row.home_latitude),
    homeLongitude: optNum(row.home_longitude),
    householdSize: optNum(row.household_size),
    shoppingFrequencyDays: optNum(row.shopping_frequency_days),
    weeklyBudgetAgorot: optNum(row.weekly_budget_agorot),
    wantsDelivery: toBool(row.wants_delivery),
    allowSubstitutions: toBool(row.allow_substitutions),
    minSubstitutionScore: num(row.min_substitution_score, 0.65),
    excludedChainIds: parseJson<string[]>(row.excluded_chain_ids, []),
    preferredChainIds: parseJson<string[]>(row.preferred_chain_ids, []),
    favoriteBrands: parseJson<string[]>(row.favorite_brands, []),
    dislikedBrands: parseJson<string[]>(row.disliked_brands, []),
    severityThresholds: parseJson<SeverityThresholds>(row.severity_thresholds, DEFAULT_PREFERENCES.severityThresholds),
    convenienceModel: parseJson<ConvenienceModel>(row.convenience_model, DEFAULT_PREFERENCES.convenienceModel),
  };
}

/**
 * Applies a partial preference update. Only the keys present in `patch` change,
 * so nothing the user set can be silently reset by an unrelated update.
 */
export function updatePreferences(
  db: DatabaseSync,
  userId: string,
  patch: Partial<UserPreferences>,
): UserPreferences {
  const current = getPreferences(db, userId);
  const next: UserPreferences = { ...current, ...patch };
  run(
    db,
    `INSERT INTO user_preferences (
        user_id, optimization_mode, max_stores, max_distance_km, city, home_latitude, home_longitude, household_size,
        shopping_frequency_days, weekly_budget_agorot, wants_delivery, allow_substitutions,
        min_substitution_score, excluded_chain_ids, preferred_chain_ids, favorite_brands,
        disliked_brands, severity_thresholds, convenience_model, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
        optimization_mode = excluded.optimization_mode,
        max_stores = excluded.max_stores,
        max_distance_km = excluded.max_distance_km,
        city = excluded.city,
        home_latitude = excluded.home_latitude,
        home_longitude = excluded.home_longitude,
        household_size = excluded.household_size,
        shopping_frequency_days = excluded.shopping_frequency_days,
        weekly_budget_agorot = excluded.weekly_budget_agorot,
        wants_delivery = excluded.wants_delivery,
        allow_substitutions = excluded.allow_substitutions,
        min_substitution_score = excluded.min_substitution_score,
        excluded_chain_ids = excluded.excluded_chain_ids,
        preferred_chain_ids = excluded.preferred_chain_ids,
        favorite_brands = excluded.favorite_brands,
        disliked_brands = excluded.disliked_brands,
        severity_thresholds = excluded.severity_thresholds,
        convenience_model = excluded.convenience_model,
        updated_at = excluded.updated_at`,
    [
      userId,
      next.optimizationMode,
      next.maxStores,
      next.maxDistanceKm,
      next.city,
      next.homeLatitude,
      next.homeLongitude,
      next.householdSize,
      next.shoppingFrequencyDays,
      next.weeklyBudgetAgorot,
      fromBool(next.wantsDelivery),
      fromBool(next.allowSubstitutions),
      next.minSubstitutionScore,
      JSON.stringify(next.excludedChainIds),
      JSON.stringify(next.preferredChainIds),
      JSON.stringify(next.favoriteBrands),
      JSON.stringify(next.dislikedBrands),
      JSON.stringify(next.severityThresholds),
      JSON.stringify(next.convenienceModel),
      nowIso(),
    ],
  );
  return next;
}

export function listMemberships(db: DatabaseSync, userId: string): string[] {
  return all<Row>(db, 'SELECT chain_id FROM memberships WHERE user_id = ? AND active = 1', [userId]).map((r) =>
    String(r.chain_id),
  );
}

export function setMembership(db: DatabaseSync, userId: string, chainId: string, active: boolean): void {
  run(
    db,
    `INSERT INTO memberships (id, user_id, chain_id, active, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, chain_id) DO UPDATE SET active = excluded.active`,
    [newId('mem'), userId, chainId, fromBool(active), nowIso()],
  );
}

/** Deletes the account and everything owned by it. Cascades handle the rest. */
export function deleteUser(db: DatabaseSync, userId: string): void {
  run(db, 'DELETE FROM users WHERE id = ?', [userId]);
}

/** Full export of a user's own data, for the privacy requirement. */
export function exportUserData(db: DatabaseSync, userId: string): Record<string, unknown> {
  const tables = [
    ['user', 'SELECT id, email, display_name, locale, created_at FROM users WHERE id = ?'],
    ['preferences', 'SELECT * FROM user_preferences WHERE user_id = ?'],
    ['memberships', 'SELECT * FROM memberships WHERE user_id = ?'],
    ['baskets', 'SELECT * FROM baskets WHERE user_id = ?'],
    ['basketItems', 'SELECT i.* FROM basket_items i JOIN baskets b ON b.id = i.basket_id WHERE b.user_id = ?'],
    ['snapshots', 'SELECT s.* FROM basket_snapshots s JOIN baskets b ON b.id = s.basket_id WHERE b.user_id = ?'],
    ['optimizations', 'SELECT * FROM optimization_results WHERE user_id = ?'],
    ['savingsEvents', 'SELECT * FROM savings_events WHERE user_id = ?'],
    ['alerts', 'SELECT * FROM price_alerts WHERE user_id = ?'],
    ['notifications', 'SELECT * FROM notifications WHERE user_id = ?'],
    ['receipts', 'SELECT * FROM receipts WHERE user_id = ?'],
  ] as const;

  const result: Record<string, unknown> = { exportedAt: nowIso() };
  for (const [key, sql] of tables) result[key] = all<Row>(db, sql, [userId]);
  return result;
}

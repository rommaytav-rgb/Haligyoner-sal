/**
 * Price alert rules: storage, evaluation and the notifications they produce.
 *
 * Rules are evaluated by the deterministic engine in the domain layer; this
 * service only supplies it with stored observations and records the results.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, fromBool, get, newId, nowIso, num, optStr, run, str, toBool, type Row } from '@/lib/db/client';
import {
  evaluateBasketAlerts,
  evaluateProductAlerts,
  type AlertKind,
  type AlertRule,
  type TriggeredAlert,
} from '@/lib/domain/alerts';
import { latestComparison } from './report';
import type { Basket } from './baskets';

export const PRODUCT_ALERT_KINDS: AlertKind[] = [
  'price_below',
  'price_increase_percent',
  'price_decrease_percent',
  'promotion_appears',
  'promotion_ends',
  'historical_low',
];

export const BASKET_ALERT_KINDS: AlertKind[] = ['basket_increase_above', 'basket_decrease_below'];

function rowToRule(row: Row): AlertRule {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    kind: str(row.kind) as AlertKind,
    productId: optStr(row.product_id),
    basketId: optStr(row.basket_id),
    thresholdValue: num(row.threshold_value),
    enabled: toBool(row.enabled),
    label: str(row.label),
    createdAt: str(row.created_at),
  };
}

export function listAlerts(db: DatabaseSync, userId: string): AlertRule[] {
  return all<Row>(db, 'SELECT * FROM price_alerts WHERE user_id = ? ORDER BY created_at DESC', [userId]).map(
    rowToRule,
  );
}

export function createAlert(
  db: DatabaseSync,
  userId: string,
  input: { kind: AlertKind; productId?: string | null; basketId?: string | null; thresholdValue: number; label: string },
): AlertRule {
  const id = newId('alr');
  const createdAt = nowIso();
  run(
    db,
    `INSERT INTO price_alerts (id, user_id, kind, product_id, basket_id, threshold_value, label, enabled, created_at)
     VALUES (?,?,?,?,?,?,?,1,?)`,
    [id, userId, input.kind, input.productId ?? null, input.basketId ?? null, input.thresholdValue, input.label, createdAt],
  );
  return {
    id,
    userId,
    kind: input.kind,
    productId: input.productId ?? null,
    basketId: input.basketId ?? null,
    thresholdValue: input.thresholdValue,
    enabled: true,
    label: input.label,
    createdAt,
  };
}

export function setAlertEnabled(db: DatabaseSync, userId: string, alertId: string, enabled: boolean): boolean {
  const existing = get<Row>(db, 'SELECT id FROM price_alerts WHERE id = ? AND user_id = ?', [alertId, userId]);
  if (!existing) return false;
  run(db, 'UPDATE price_alerts SET enabled = ? WHERE id = ?', [fromBool(enabled), alertId]);
  return true;
}

export function deleteAlert(db: DatabaseSync, userId: string, alertId: string): boolean {
  const existing = get<Row>(db, 'SELECT id FROM price_alerts WHERE id = ? AND user_id = ?', [alertId, userId]);
  if (!existing) return false;
  run(db, 'DELETE FROM price_alerts WHERE id = ?', [alertId]);
  return true;
}

/**
 * Evaluates every rule the user has, using the newest verified observation for
 * each product and the newest pair of basket snapshots.
 */
export function evaluateAlerts(
  db: DatabaseSync,
  userId: string,
  baskets: readonly Basket[],
  options: { now?: string; sinceDays?: number } = {},
): TriggeredAlert[] {
  const now = options.now ?? nowIso();
  const sinceDays = options.sinceDays ?? 7;
  const rules = listAlerts(db, userId).filter((rule) => rule.enabled);
  if (rules.length === 0) return [];

  const triggered: TriggeredAlert[] = [];
  const productRules = rules.filter((r) => r.productId !== null);
  const productIds = [...new Set(productRules.map((r) => r.productId as string))];

  for (const productId of productIds) {
    const current = get<Row>(
      db,
      `SELECT pr.*, p.name_he AS product_name FROM prices pr JOIN products p ON p.id = pr.product_id
        WHERE pr.product_id = ? ORDER BY pr.price_agorot ASC, pr.branch_id ASC LIMIT 1`,
      [productId],
    );
    if (!current) continue;
    const chainId = str(current.chain_id);
    const branchId = str(current.branch_id);
    const cutoff = new Date(Date.parse(now) - sinceDays * 86_400_000).toISOString();
    // Same product, same branch: a rule must not fire because the cheapest shop
    // changed, only because a price actually moved.
    const previous = get<Row>(
      db,
      `SELECT * FROM price_history WHERE product_id = ? AND branch_id = ? AND observed_at <= ?
        ORDER BY observed_at DESC LIMIT 1`,
      [productId, branchId, cutoff],
    );
    const lowRow = get<Row>(db, 'SELECT MIN(price_agorot) AS low, COUNT(*) AS n FROM price_history WHERE product_id = ?', [
      productId,
    ]);

    triggered.push(
      ...evaluateProductAlerts(productRules, {
        productId,
        displayName: str(current.product_name),
        currentPriceAgorot: num(current.price_agorot),
        previousPriceAgorot: previous ? num(previous.price_agorot) : null,
        currentPromotionId: optStr(current.promotion_id),
        previousPromotionId: previous ? optStr(previous.promotion_id) : null,
        historicalLowAgorot: lowRow ? num(lowRow.low) : null,
        observationCount: lowRow ? num(lowRow.n) : 0,
        observedAt: str(current.observed_at),
        chainId,
      }),
    );
  }

  const basketRules = rules.filter((r) => r.basketId !== null);
  for (const basket of baskets) {
    const scoped = basketRules.filter((r) => r.basketId === basket.id);
    if (scoped.length === 0) continue;
    const comparison = latestComparison(db, basket.id);
    if (!comparison) continue;
    triggered.push(
      ...evaluateBasketAlerts(scoped, {
        basketId: basket.id,
        currentTotalAgorot: comparison.summary.currentTotalAgorot,
        previousTotalAgorot: comparison.summary.previousTotalAgorot,
        comparableCoverage: comparison.summary.comparableCoverage,
        capturedAt: comparison.summary.currentCapturedAt,
      }),
    );
  }

  return triggered;
}

/**
 * Persists triggered alerts as notifications.
 *
 * Notifications store facts, not sentences: the UI renders them in the reader's
 * language, and the numbers stay exactly as the engine computed them.
 */
export function recordNotifications(
  db: DatabaseSync,
  userId: string,
  triggered: readonly TriggeredAlert[],
): number {
  let written = 0;
  for (const alert of triggered) {
    // One notification per rule per trigger time; re-running evaluation is idempotent.
    const id = `ntf_${alert.ruleId}_${alert.triggeredAt}`;
    const existing = get<Row>(db, 'SELECT id FROM notifications WHERE id = ?', [id]);
    if (existing) continue;
    run(
      db,
      'INSERT INTO notifications (id, user_id, kind, title_key, facts_json, read_at, created_at) VALUES (?,?,?,?,?,NULL,?)',
      [id, userId, alert.kind, `alerts.kind.${alert.kind}`, JSON.stringify(alert.facts), nowIso()],
    );
    written += 1;
  }
  return written;
}

export function markNotificationRead(db: DatabaseSync, userId: string, notificationId: string): boolean {
  const existing = get<Row>(db, 'SELECT id FROM notifications WHERE id = ? AND user_id = ?', [
    notificationId,
    userId,
  ]);
  if (!existing) return false;
  run(db, 'UPDATE notifications SET read_at = ? WHERE id = ?', [nowIso(), notificationId]);
  return true;
}

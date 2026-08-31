/**
 * Weekly report and savings rollups.
 *
 * Compares the two most recent priced snapshots of a basket, explains the
 * difference, and rolls up savings for the week, month and year with potential
 * and confirmed kept apart.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, nowIso, num, optStr, str, type Row } from '@/lib/db/client';
import {
  compareBaskets,
  contributionsReconcile,
  type BasketChangeSummary,
  type BasketSnapshot,
} from '@/lib/domain/basket-change';
import { rollupSavings, type SavingsRollup } from '@/lib/domain/savings';
import type { SeverityThresholds } from '@/lib/domain/price-change';
import { loadSnapshot } from './pricing';

export function toDomainSnapshot(
  loaded: NonNullable<ReturnType<typeof loadSnapshot>>,
): BasketSnapshot {
  return {
    id: loaded.id,
    capturedAt: loaded.capturedAt,
    lines: loaded.lines.map((line) => ({
      productId: line.productId,
      displayName: line.displayName,
      quantity: line.quantity,
      unitPriceAgorot: line.unitPriceAgorot,
      effectiveTotalAgorot: line.effectiveTotalAgorot,
      promotionId: line.promotionId,
      chainId: line.chainId,
      observedAt: line.observedAt,
    })),
    unpricedProductIds: loaded.unpricedLineIds,
  };
}

export function listSnapshots(
  db: DatabaseSync,
  basketId: string,
  limit = 12,
): Array<{ id: string; capturedAt: string; totalAgorot: number; planKind: string; coveredLineCount: number }> {
  return all<Row>(
    db,
    'SELECT * FROM basket_snapshots WHERE basket_id = ? ORDER BY captured_at DESC LIMIT ?',
    [basketId, limit],
  ).map((row) => ({
    id: str(row.id),
    capturedAt: str(row.captured_at),
    totalAgorot: num(row.total_agorot),
    planKind: str(row.plan_kind),
    coveredLineCount: num(row.covered_line_count),
  }));
}

export interface BasketComparison {
  summary: BasketChangeSummary;
  previousSnapshotId: string;
  currentSnapshotId: string;
  /** Self-check: the line contributions must add up to the reported total change. */
  reconciles: boolean;
}

/** Compares the two most recent snapshots, or two named ones. */
export function compareSnapshots(
  db: DatabaseSync,
  previousId: string,
  currentId: string,
  thresholds?: SeverityThresholds,
): BasketComparison | null {
  const previous = loadSnapshot(db, previousId);
  const current = loadSnapshot(db, currentId);
  if (!previous || !current) return null;
  const summary = compareBaskets(toDomainSnapshot(previous), toDomainSnapshot(current), thresholds);
  return {
    summary,
    previousSnapshotId: previousId,
    currentSnapshotId: currentId,
    reconciles: contributionsReconcile(summary),
  };
}

export function latestComparison(
  db: DatabaseSync,
  basketId: string,
  thresholds?: SeverityThresholds,
): BasketComparison | null {
  const snapshots = listSnapshots(db, basketId, 2);
  const current = snapshots[0];
  const previous = snapshots[1];
  if (!current || !previous) return null;
  return compareSnapshots(db, previous.id, current.id, thresholds);
}

export interface SavingsSummary {
  week: SavingsRollup;
  month: SavingsRollup;
  year: SavingsRollup;
}

export function savingsSummary(db: DatabaseSync, userId: string, now = nowIso()): SavingsSummary {
  const events = all<Row>(db, 'SELECT nature, saving_agorot, occurred_at FROM savings_events WHERE user_id = ?', [
    userId,
  ]).map((row) => ({
    nature: str(row.nature) === 'confirmed' ? ('confirmed' as const) : ('potential' as const),
    savingAgorot: num(row.saving_agorot),
    occurredAt: str(row.occurred_at),
  }));

  const nowMs = Date.parse(now);
  const since = (days: number) => new Date(nowMs - days * 86_400_000).toISOString();
  return {
    week: rollupSavings(events, since(7), now),
    month: rollupSavings(events, since(30), now),
    year: rollupSavings(events, since(365), now),
  };
}

export interface NotificationRecord {
  id: string;
  kind: string;
  titleKey: string;
  facts: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function listNotifications(db: DatabaseSync, userId: string, limit = 30): NotificationRecord[] {
  return all<Row>(db, 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [
    userId,
    limit,
  ]).map((row) => ({
    id: str(row.id),
    kind: str(row.kind),
    titleKey: str(row.title_key),
    facts: JSON.parse(str(row.facts_json, '{}')) as Record<string, unknown>,
    readAt: optStr(row.read_at),
    createdAt: str(row.created_at),
  }));
}

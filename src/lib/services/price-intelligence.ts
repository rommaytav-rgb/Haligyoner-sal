/**
 * Price intelligence: the read model behind Price Watch, product timelines,
 * personal baselines and the "should I buy now?" answer.
 *
 * Everything is derived from `price_history`. Where history is too thin, the
 * response says so instead of filling the gap.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, get, nowIso, num, optStr, str, toBool, type Row } from '@/lib/db/client';
import {
  adviseOnPurchase,
  computeBaseline,
  priceAsOf,
  windowAverage,
  type BuyAdvice,
  type HistoricalPoint,
  type PersonalBaseline,
} from '@/lib/domain/baseline';
import {
  comparePrices,
  DEFAULT_SEVERITY_THRESHOLDS,
  percentageChange,
  type PriceChange,
  type PriceObservation,
  type SeverityThresholds,
} from '@/lib/domain/price-change';
import type { Agorot } from '@/lib/domain/money';

export interface HistoryQuery {
  productId: string;
  /** Restrict to one chain, or compare across all of them when null. */
  chainId?: string | null;
  branchId?: string | null;
  sinceDays?: number;
  limit?: number;
}

export function loadHistory(db: DatabaseSync, query: HistoryQuery, now = nowIso()): HistoricalPoint[] {
  const conditions = ['h.product_id = ?'];
  const params: Array<string | number> = [query.productId];
  if (query.chainId) {
    conditions.push('h.chain_id = ?');
    params.push(query.chainId);
  }
  if (query.branchId) {
    conditions.push('h.branch_id = ?');
    params.push(query.branchId);
  }
  if (query.sinceDays !== undefined) {
    conditions.push('h.observed_at >= ?');
    params.push(new Date(Date.parse(now) - query.sinceDays * 86_400_000).toISOString());
  }
  params.push(query.limit ?? 500);

  return all<Row>(
    db,
    `SELECT h.* FROM price_history h WHERE ${conditions.join(' AND ')} ORDER BY h.observed_at ASC LIMIT ?`,
    params,
  ).map((row) => ({
    priceAgorot: num(row.price_agorot),
    observedAt: str(row.observed_at),
    isPromotional: optStr(row.promotion_id) !== null,
    isMemberPrice: toBool(row.is_member_price),
    chainId: str(row.chain_id),
    source: str(row.source),
  }));
}

export interface TimelinePoint {
  observedAt: string;
  priceAgorot: Agorot;
  isPromotional: boolean;
  /** Change against the previous point in this timeline, when comparable. */
  percentageChange: number | null;
  chainId: string;
}

/** Collapses history into one point per day per chain, newest last. */
export function buildTimeline(history: readonly HistoricalPoint[]): TimelinePoint[] {
  const byDay = new Map<string, HistoricalPoint>();
  for (const point of history) {
    const day = point.observedAt.slice(0, 10);
    const key = `${day}|${point.chainId}`;
    const existing = byDay.get(key);
    if (!existing || point.observedAt > existing.observedAt) byDay.set(key, point);
  }
  const ordered = [...byDay.values()].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const timeline: TimelinePoint[] = [];
  let previous: HistoricalPoint | null = null;
  for (const point of ordered) {
    // Only compare within the same chain: a cross-chain jump is not a price change.
    const comparable = previous !== null && previous.chainId === point.chainId ? previous : null;
    timeline.push({
      observedAt: point.observedAt,
      priceAgorot: point.priceAgorot,
      isPromotional: point.isPromotional,
      percentageChange: comparable ? percentageChange(comparable.priceAgorot, point.priceAgorot) : null,
      chainId: point.chainId,
    });
    previous = point;
  }
  return timeline;
}

export interface ProductIntelligence {
  productId: string;
  displayName: string;
  /** Cheapest currently verified price across the branches we hold data for. */
  currentBestPriceAgorot: Agorot | null;
  currentBestChainId: string | null;
  currentObservedAt: string | null;
  baseline: PersonalBaseline;
  timeline: TimelinePoint[];
  comparisons: {
    sevenDays: { priceAgorot: Agorot; observedAt: string } | null;
    thirtyDays: { priceAgorot: Agorot; observedAt: string } | null;
    ninetyDayAverage: { averageAgorot: Agorot; sampleCount: number; coversFullWindow: boolean } | null;
    /** Percentage of the current price against the 90-day average. */
    vsNinetyDayAveragePercent: number | null;
  };
  advice: BuyAdvice | null;
  observationCount: number;
}

export function productIntelligence(
  db: DatabaseSync,
  productId: string,
  options: { chainId?: string | null; now?: string } = {},
): ProductIntelligence | null {
  const now = options.now ?? nowIso();
  const productRow = get<Row>(db, 'SELECT id, name_he FROM products WHERE id = ?', [productId]);
  if (!productRow) return null;

  const history = loadHistory(db, { productId, chainId: options.chainId ?? null, sinceDays: 180 }, now);
  const baseline = computeBaseline(history);

  const currentRow = get<Row>(
    db,
    `SELECT price_agorot, chain_id, observed_at FROM prices
      WHERE product_id = ? ${options.chainId ? 'AND chain_id = ?' : ''}
      ORDER BY price_agorot ASC LIMIT 1`,
    options.chainId ? [productId, options.chainId] : [productId],
  );

  const sevenDays = priceAsOf(history, 7, now);
  const thirtyDays = priceAsOf(history, 30, now);
  const ninetyDayAverage = windowAverage(history, 90, now);
  const currentPrice = currentRow ? num(currentRow.price_agorot) : null;

  const activePromotionRow = currentRow
    ? get<Row>(
        db,
        `SELECT p.id, p.description, p.ends_at
           FROM prices pr JOIN promotions p ON p.id = pr.promotion_id
          WHERE pr.product_id = ? AND pr.chain_id = ?`,
        [productId, str(currentRow.chain_id)],
      )
    : null;

  return {
    productId,
    displayName: str(productRow.name_he),
    currentBestPriceAgorot: currentPrice,
    currentBestChainId: currentRow ? str(currentRow.chain_id) : null,
    currentObservedAt: currentRow ? str(currentRow.observed_at) : null,
    baseline,
    timeline: buildTimeline(history),
    comparisons: {
      sevenDays: sevenDays ? { priceAgorot: sevenDays.priceAgorot, observedAt: sevenDays.observedAt } : null,
      thirtyDays: thirtyDays ? { priceAgorot: thirtyDays.priceAgorot, observedAt: thirtyDays.observedAt } : null,
      ninetyDayAverage,
      vsNinetyDayAveragePercent:
        currentPrice !== null && ninetyDayAverage
          ? percentageChange(ninetyDayAverage.averageAgorot, currentPrice)
          : null,
    },
    advice:
      currentPrice === null
        ? null
        : adviseOnPurchase(currentPrice, history, {
            activePromotion: activePromotionRow
              ? {
                  id: str(activePromotionRow.id),
                  description: str(activePromotionRow.description),
                  endsAt: optStr(activePromotionRow.ends_at),
                }
              : null,
          }),
    observationCount: history.length,
  };
}

export interface WatchEntry {
  productId: string;
  displayName: string;
  change: PriceChange;
  chainId: string;
  /** The branch the current price came from, and the branch the change is measured at. */
  branchId: string;
  currentPriceAgorot: Agorot;
}

/**
 * The Price Watch feed for a basket: for each item, the movement of its cheapest
 * verified price against the newest earlier observation at the same chain.
 */
export function basketWatch(
  db: DatabaseSync,
  productIds: readonly string[],
  options: { sinceDays?: number; thresholds?: SeverityThresholds; now?: string } = {},
): WatchEntry[] {
  const now = options.now ?? nowIso();
  const sinceDays = options.sinceDays ?? 7;
  const thresholds = options.thresholds ?? DEFAULT_SEVERITY_THRESHOLDS;
  const entries: WatchEntry[] = [];

  for (const productId of productIds) {
    const current = get<Row>(
      db,
      `SELECT pr.*, p.name_he AS product_name, p.package_base_qty
         FROM prices pr JOIN products p ON p.id = pr.product_id
        WHERE pr.product_id = ? ORDER BY pr.price_agorot ASC, pr.branch_id ASC LIMIT 1`,
      [productId],
    );
    if (!current) continue;

    const chainId = str(current.chain_id);
    const branchId = str(current.branch_id);
    const cutoff = new Date(Date.parse(now) - sinceDays * 86_400_000).toISOString();
    // The comparison point is the newest observation of the same product at the
    // same *branch* that is at least `sinceDays` old. Comparing across branches
    // would report shelf-price differences between shops as a price change, and
    // comparing to a same-day reading would say nothing at all.
    const previous = get<Row>(
      db,
      `SELECT h.*, p.package_base_qty
         FROM price_history h JOIN products p ON p.id = h.product_id
        WHERE h.product_id = ? AND h.branch_id = ? AND h.observed_at <= ?
        ORDER BY h.observed_at DESC LIMIT 1`,
      [productId, branchId, cutoff],
    );

    const toObservation = (row: Row, isCurrent: boolean): PriceObservation => ({
      priceAgorot: num(row.price_agorot),
      observedAt: str(row.observed_at),
      chainId: str(row.chain_id),
      branchId: optStr(row.branch_id),
      productId,
      packageSizeBaseUnits: row.package_base_qty === null ? null : num(row.package_base_qty),
      promotionId: optStr(row.promotion_id),
      isMemberPrice: toBool(row.is_member_price),
      source: str(row.source),
      confidence: isCurrent ? num(row.confidence, 1) : num(row.confidence, 1),
    });

    entries.push({
      productId,
      displayName: str(current.product_name),
      chainId,
      branchId,
      currentPriceAgorot: num(current.price_agorot),
      change: comparePrices(
        previous ? toObservation(previous, false) : null,
        toObservation(current, true),
        { thresholds, recentComparisonMaxDays: Math.max(sinceDays, 7) },
      ),
    });
  }

  return entries;
}

export interface MovementGroup {
  rising: WatchEntry[];
  falling: WatchEntry[];
  unchanged: WatchEntry[];
  unavailable: WatchEntry[];
}

export function groupMovements(entries: readonly WatchEntry[]): MovementGroup {
  const rising: WatchEntry[] = [];
  const falling: WatchEntry[] = [];
  const unchanged: WatchEntry[] = [];
  const unavailable: WatchEntry[] = [];
  for (const entry of entries) {
    if (!entry.change.comparable) unavailable.push(entry);
    else if (entry.change.direction === 'increase') rising.push(entry);
    else if (entry.change.direction === 'decrease') falling.push(entry);
    else unchanged.push(entry);
  }
  const byMagnitude = (a: WatchEntry, b: WatchEntry) => {
    const pa = a.change.comparable ? Math.abs(a.change.percentageChange) : 0;
    const pb = b.change.comparable ? Math.abs(b.change.percentageChange) : 0;
    return pb - pa;
  };
  rising.sort(byMagnitude);
  falling.sort(byMagnitude);
  return { rising, falling, unchanged, unavailable };
}

export interface AggregateMovement {
  key: string;
  label: string;
  percentageChange: number;
  productCount: number;
}

/**
 * Average price movement per chain or per category over a window.
 *
 * Only products with a comparable observation on both ends of the window count,
 * and a group needs `minProducts` of them before a figure is reported — a single
 * product's move is not a statement about a whole chain.
 */
export function aggregateMovement(
  db: DatabaseSync,
  dimension: 'chain' | 'category',
  options: { sinceDays?: number; now?: string; minProducts?: number } = {},
): AggregateMovement[] {
  const now = options.now ?? nowIso();
  const sinceDays = options.sinceDays ?? 30;
  const minProducts = options.minProducts ?? 5;
  const cutoff = new Date(Date.parse(now) - sinceDays * 86_400_000).toISOString();

  const rows = all<Row>(
    db,
    dimension === 'chain'
      ? `SELECT h.chain_id AS group_key, c.name_he AS group_label, h.product_id, h.observed_at, h.price_agorot
           FROM price_history h JOIN supermarket_chains c ON c.id = h.chain_id
          WHERE h.observed_at >= ? ORDER BY h.observed_at ASC`
      : `SELECT COALESCE(cat.key, 'uncategorised') AS group_key, COALESCE(cat.name_he, 'uncategorised') AS group_label,
                h.product_id, h.observed_at, h.price_agorot
           FROM price_history h JOIN products p ON p.id = h.product_id
           LEFT JOIN categories cat ON cat.id = p.category_id
          WHERE h.observed_at >= ? ORDER BY h.observed_at ASC`,
    [cutoff],
  );

  // first/last price per (group, product) inside the window
  const series = new Map<string, { label: string; first: number; last: number }>();
  for (const row of rows) {
    const key = `${str(row.group_key)}|${str(row.product_id)}`;
    const price = num(row.price_agorot);
    const existing = series.get(key);
    if (existing) existing.last = price;
    else series.set(key, { label: str(row.group_label), first: price, last: price });
  }

  const grouped = new Map<string, { label: string; changes: number[] }>();
  for (const [key, value] of series) {
    const groupKey = key.split('|')[0] as string;
    const pct = percentageChange(value.first, value.last);
    if (pct === null) continue;
    const bucket = grouped.get(groupKey);
    if (bucket) bucket.changes.push(pct);
    else grouped.set(groupKey, { label: value.label, changes: [pct] });
  }

  const results: AggregateMovement[] = [];
  for (const [key, bucket] of grouped) {
    if (bucket.changes.length < minProducts) continue;
    const mean = bucket.changes.reduce((a, b) => a + b, 0) / bucket.changes.length;
    results.push({
      key,
      label: bucket.label,
      percentageChange: Math.round(mean * 10) / 10,
      productCount: bucket.changes.length,
    });
  }
  return results.sort((a, b) => b.percentageChange - a.percentageChange);
}

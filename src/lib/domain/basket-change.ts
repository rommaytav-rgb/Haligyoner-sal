/**
 * BasketPriceChangeService — deterministic comparison of two priced baskets.
 *
 * Powers "your basket got cheaper", the weekly report, and the "what changed?"
 * breakdown. Every number here is arithmetic on stored observations.
 */

import { sumAgorot, type Agorot } from './money';
import {
  classifySeverity,
  percentageChange,
  roundTo,
  type PriceDirection,
  type PriceSeverity,
  type SeverityThresholds,
  DEFAULT_SEVERITY_THRESHOLDS,
} from './price-change';

/** One line of a basket, already priced against a specific snapshot. */
export interface BasketSnapshotLine {
  productId: string;
  displayName: string;
  quantity: number;
  /** Per-unit regular price used for this snapshot. */
  unitPriceAgorot: Agorot;
  /** Line total actually paid/estimated, after promotions the user qualifies for. */
  effectiveTotalAgorot: Agorot;
  promotionId: string | null;
  chainId: string | null;
  observedAt: string;
}

export interface BasketSnapshot {
  id: string;
  capturedAt: string;
  lines: readonly BasketSnapshotLine[];
  /** Lines we could not price. Excluded from totals and reported explicitly. */
  unpricedProductIds: readonly string[];
}

export type LineChangeKind = 'increased' | 'decreased' | 'unchanged' | 'added' | 'removed';

export interface BasketLineChange {
  productId: string;
  displayName: string;
  kind: LineChangeKind;
  previousTotalAgorot: Agorot | null;
  currentTotalAgorot: Agorot | null;
  /** Contribution of this line to the basket delta, in agorot. */
  contributionAgorot: Agorot;
  previousUnitPriceAgorot: Agorot | null;
  currentUnitPriceAgorot: Agorot | null;
  unitPercentageChange: number | null;
  direction: PriceDirection | null;
  severity: PriceSeverity | null;
  promotionTransition: 'promotion_started' | 'promotion_ended' | 'promotion_changed' | null;
}

export interface BasketChangeSummary {
  previousTotalAgorot: Agorot;
  currentTotalAgorot: Agorot;
  absoluteChangeAgorot: Agorot;
  percentageChange: number | null;
  direction: PriceDirection;
  counts: {
    increased: number;
    decreased: number;
    unchanged: number;
    added: number;
    removed: number;
    promotionsAppeared: number;
    promotionsEnded: number;
  };
  /** Only lines present in both snapshots, ranked by contribution. */
  biggestIncreases: BasketLineChange[];
  biggestDecreases: BasketLineChange[];
  lines: BasketLineChange[];
  /** Products that could not be priced in either snapshot. Never silently dropped. */
  unpricedProductIds: string[];
  /**
   * True only when both snapshots priced exactly the same set of products.
   * When false, the totals differ partly because of coverage, not only price.
   */
  comparableCoverage: boolean;
  previousCapturedAt: string;
  currentCapturedAt: string;
}

function indexLines(snapshot: BasketSnapshot): Map<string, BasketSnapshotLine> {
  const map = new Map<string, BasketSnapshotLine>();
  for (const line of snapshot.lines) map.set(line.productId, line);
  return map;
}

export function compareBaskets(
  previous: BasketSnapshot,
  current: BasketSnapshot,
  thresholds: SeverityThresholds = DEFAULT_SEVERITY_THRESHOLDS,
): BasketChangeSummary {
  const prevLines = indexLines(previous);
  const currLines = indexLines(current);
  const productIds = new Set<string>([...prevLines.keys(), ...currLines.keys()]);

  const changes: BasketLineChange[] = [];
  const counts = {
    increased: 0,
    decreased: 0,
    unchanged: 0,
    added: 0,
    removed: 0,
    promotionsAppeared: 0,
    promotionsEnded: 0,
  };

  for (const productId of productIds) {
    const before = prevLines.get(productId);
    const after = currLines.get(productId);

    if (before && !after) {
      counts.removed += 1;
      changes.push({
        productId,
        displayName: before.displayName,
        kind: 'removed',
        previousTotalAgorot: before.effectiveTotalAgorot,
        currentTotalAgorot: null,
        contributionAgorot: -before.effectiveTotalAgorot,
        previousUnitPriceAgorot: before.unitPriceAgorot,
        currentUnitPriceAgorot: null,
        unitPercentageChange: null,
        direction: null,
        severity: null,
        promotionTransition: null,
      });
      continue;
    }
    if (!before && after) {
      counts.added += 1;
      changes.push({
        productId,
        displayName: after.displayName,
        kind: 'added',
        previousTotalAgorot: null,
        currentTotalAgorot: after.effectiveTotalAgorot,
        contributionAgorot: after.effectiveTotalAgorot,
        previousUnitPriceAgorot: null,
        currentUnitPriceAgorot: after.unitPriceAgorot,
        unitPercentageChange: null,
        direction: null,
        severity: null,
        promotionTransition: null,
      });
      continue;
    }
    if (!before || !after) continue;

    const contribution = after.effectiveTotalAgorot - before.effectiveTotalAgorot;
    const unitPct = percentageChange(before.unitPriceAgorot, after.unitPriceAgorot);
    let direction: PriceDirection = 'unchanged';
    if (contribution > 0) direction = 'increase';
    else if (contribution < 0) direction = 'decrease';

    let promotionTransition: BasketLineChange['promotionTransition'] = null;
    if (!before.promotionId && after.promotionId) {
      promotionTransition = 'promotion_started';
      counts.promotionsAppeared += 1;
    } else if (before.promotionId && !after.promotionId) {
      promotionTransition = 'promotion_ended';
      counts.promotionsEnded += 1;
    } else if (before.promotionId && after.promotionId && before.promotionId !== after.promotionId) {
      promotionTransition = 'promotion_changed';
    }

    let kind: LineChangeKind = 'unchanged';
    if (contribution > 0) {
      kind = 'increased';
      counts.increased += 1;
    } else if (contribution < 0) {
      kind = 'decreased';
      counts.decreased += 1;
    } else {
      counts.unchanged += 1;
    }

    changes.push({
      productId,
      displayName: after.displayName,
      kind,
      previousTotalAgorot: before.effectiveTotalAgorot,
      currentTotalAgorot: after.effectiveTotalAgorot,
      contributionAgorot: contribution,
      previousUnitPriceAgorot: before.unitPriceAgorot,
      currentUnitPriceAgorot: after.unitPriceAgorot,
      unitPercentageChange: unitPct,
      direction,
      severity: unitPct === null ? null : classifySeverity(unitPct, thresholds),
      promotionTransition,
    });
  }

  const previousTotal = sumAgorot(previous.lines.map((l) => l.effectiveTotalAgorot));
  const currentTotal = sumAgorot(current.lines.map((l) => l.effectiveTotalAgorot));
  const absolute = currentTotal - previousTotal;

  const bothSided = changes.filter((c) => c.kind === 'increased' || c.kind === 'decreased');
  const biggestIncreases = bothSided
    .filter((c) => c.contributionAgorot > 0)
    .sort((a, b) => b.contributionAgorot - a.contributionAgorot);
  const biggestDecreases = bothSided
    .filter((c) => c.contributionAgorot < 0)
    .sort((a, b) => a.contributionAgorot - b.contributionAgorot);

  const unpriced = Array.from(new Set([...previous.unpricedProductIds, ...current.unpricedProductIds]));

  return {
    previousTotalAgorot: previousTotal,
    currentTotalAgorot: currentTotal,
    absoluteChangeAgorot: absolute,
    percentageChange: percentageChange(previousTotal, currentTotal),
    direction: absolute > 0 ? 'increase' : absolute < 0 ? 'decrease' : 'unchanged',
    counts,
    biggestIncreases,
    biggestDecreases,
    lines: changes.sort((a, b) => Math.abs(b.contributionAgorot) - Math.abs(a.contributionAgorot)),
    unpricedProductIds: unpriced,
    comparableCoverage: counts.added === 0 && counts.removed === 0 && unpriced.length === 0,
    previousCapturedAt: previous.capturedAt,
    currentCapturedAt: current.capturedAt,
  };
}

/**
 * Verifies that the reported line contributions actually sum to the reported
 * basket delta. Used by tests and by the report builder as a self-check: if this
 * ever fails, the explanation shown to the user would not match the total.
 */
export function contributionsReconcile(summary: BasketChangeSummary): boolean {
  const sum = summary.lines.reduce((acc, line) => acc + line.contributionAgorot, 0);
  return sum === summary.absoluteChangeAgorot;
}

/** Percentage of the basket delta explained by the top `n` contributors. */
export function explainedShare(summary: BasketChangeSummary, n: number): number | null {
  if (summary.absoluteChangeAgorot === 0) return null;
  const top = summary.lines.slice(0, n).reduce((acc, l) => acc + Math.abs(l.contributionAgorot), 0);
  const total = summary.lines.reduce((acc, l) => acc + Math.abs(l.contributionAgorot), 0);
  if (total === 0) return null;
  return roundTo((top / total) * 100, 1);
}

import { describe, expect, it } from 'vitest';
import {
  compareBaskets,
  contributionsReconcile,
  explainedShare,
  type BasketSnapshot,
  type BasketSnapshotLine,
} from './basket-change';

function line(
  productId: string,
  displayName: string,
  unitPriceAgorot: number,
  quantity = 1,
  promotionId: string | null = null,
): BasketSnapshotLine {
  return {
    productId,
    displayName,
    quantity,
    unitPriceAgorot,
    effectiveTotalAgorot: unitPriceAgorot * quantity,
    promotionId,
    chainId: 'rami-levy',
    observedAt: '2026-08-31T08:00:00Z',
  };
}

function snapshot(id: string, capturedAt: string, lines: BasketSnapshotLine[]): BasketSnapshot {
  return { id, capturedAt, lines, unpricedProductIds: [] };
}

describe('compareBaskets', () => {
  // The specification's headline example: ₪612 last week, ₪598 this week.
  const previous = snapshot('w1', '2026-08-24T08:00:00Z', [
    line('coffee', 'Coffee', 2400),
    line('chicken', 'Chicken', 3200),
    line('milk', 'Milk', 1200),
    line('rice', 'Rice', 1400),
    line('rest', 'Everything else', 53000),
  ]);
  const current = snapshot('w2', '2026-08-31T08:00:00Z', [
    line('coffee', 'Coffee', 3100),
    line('chicken', 'Chicken', 3500),
    line('milk', 'Milk', 1000),
    line('rice', 'Rice', 1000),
    line('rest', 'Everything else', 51200),
  ]);

  it('computes the basket delta and percentage', () => {
    const summary = compareBaskets(previous, current);
    expect(summary.previousTotalAgorot).toBe(61200);
    expect(summary.currentTotalAgorot).toBe(59800);
    expect(summary.absoluteChangeAgorot).toBe(-1400);
    expect(summary.percentageChange).toBe(-2.3);
    expect(summary.direction).toBe('decrease');
  });

  it('ranks the biggest contributors, matching the weekly report', () => {
    const summary = compareBaskets(previous, current);
    expect(summary.biggestIncreases[0]).toMatchObject({ productId: 'coffee', unitPercentageChange: 29.2 });
    expect(summary.biggestIncreases[1]).toMatchObject({ productId: 'chicken', unitPercentageChange: 9.4 });
    expect(summary.biggestDecreases[0]).toMatchObject({ productId: 'rest' });
    const rice = summary.lines.find((l) => l.productId === 'rice');
    expect(rice?.unitPercentageChange).toBe(-28.6);
    const milk = summary.lines.find((l) => l.productId === 'milk');
    expect(milk?.unitPercentageChange).toBe(-16.7);
  });

  it('counts what changed', () => {
    const summary = compareBaskets(previous, current);
    expect(summary.counts.increased).toBe(2);
    expect(summary.counts.decreased).toBe(3);
    expect(summary.counts.unchanged).toBe(0);
  });

  it('reconciles line contributions against the reported total', () => {
    const summary = compareBaskets(previous, current);
    expect(contributionsReconcile(summary)).toBe(true);
    expect(explainedShare(summary, 2)).toBeGreaterThan(0);
  });

  it('tracks added and removed products separately from price movement', () => {
    const withExtra = snapshot('w2', '2026-08-31T08:00:00Z', [
      ...current.lines,
      line('cereal', 'Cereal', 2200),
    ]);
    const summary = compareBaskets(previous, withExtra);
    expect(summary.counts.added).toBe(1);
    expect(summary.comparableCoverage).toBe(false);
    expect(contributionsReconcile(summary)).toBe(true);
  });

  it('counts promotions appearing and ending', () => {
    const before = snapshot('a', '2026-08-24T08:00:00Z', [
      line('cereal', 'Cereal', 2200, 1, 'promo-old'),
      line('coffee', 'Coffee', 2400),
    ]);
    const after = snapshot('b', '2026-08-31T08:00:00Z', [
      line('cereal', 'Cereal', 2600),
      line('coffee', 'Coffee', 1800, 1, 'promo-new'),
    ]);
    const summary = compareBaskets(before, after);
    expect(summary.counts.promotionsAppeared).toBe(1);
    expect(summary.counts.promotionsEnded).toBe(1);
  });

  it('flags coverage gaps so a cheaper total cannot hide missing items', () => {
    const gappy: BasketSnapshot = { ...current, unpricedProductIds: ['shampoo'] };
    const summary = compareBaskets(previous, gappy);
    expect(summary.comparableCoverage).toBe(false);
    expect(summary.unpricedProductIds).toContain('shampoo');
  });
});

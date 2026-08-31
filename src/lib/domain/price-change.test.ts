import { describe, expect, it } from 'vitest';
import {
  classifySeverity,
  comparePrices,
  DEFAULT_SEVERITY_THRESHOLDS,
  percentageChange,
  roundTo,
  type PriceObservation,
} from './price-change';

function obs(overrides: Partial<PriceObservation> & { priceAgorot: number; observedAt: string }): PriceObservation {
  return {
    chainId: 'rami-levy',
    branchId: 'rl-001',
    productId: 'p-coffee-200g',
    packageSizeBaseUnits: 200,
    promotionId: null,
    isMemberPrice: false,
    source: 'test',
    confidence: 1,
    ...overrides,
  };
}

describe('percentageChange', () => {
  it('matches the product specification examples exactly', () => {
    expect(percentageChange(1000, 1200)).toBe(20); // ₪10 -> ₪12
    expect(percentageChange(2500, 2200)).toBe(-12); // ₪25 -> ₪22
    expect(percentageChange(1500, 1500)).toBe(0);
    expect(percentageChange(3200, 3900)).toBe(21.9); // chicken
    expect(percentageChange(2400, 2800)).toBe(16.7); // coffee
    expect(percentageChange(1200, 1000)).toBe(-16.7); // milk
    expect(percentageChange(1400, 1100)).toBe(-21.4); // rice
    expect(percentageChange(2400, 3100)).toBe(29.2); // coffee weekly report
    expect(percentageChange(1400, 1000)).toBe(-28.6); // rice weekly report
    expect(percentageChange(2000, 1500)).toBe(-25); // promotion starts
    expect(percentageChange(1500, 2000)).toBe(33.3); // promotion ends
    expect(percentageChange(61200, 59800)).toBe(-2.3); // basket 612 -> 598
    expect(percentageChange(1050, 1200)).toBe(14.3); // vs 90-day average
  });

  it('returns null when the baseline is zero', () => {
    expect(percentageChange(0, 1200)).toBeNull();
  });

  it('rounds half away from zero', () => {
    expect(roundTo(2.25, 1)).toBe(2.3);
    expect(roundTo(-2.25, 1)).toBe(-2.3);
    expect(roundTo(1.005, 2)).toBe(1.01);
  });
});

describe('classifySeverity', () => {
  it('uses the configured bands', () => {
    expect(classifySeverity(1.5)).toBe('minimal');
    expect(classifySeverity(3)).toBe('small');
    expect(classifySeverity(-7)).toBe('moderate');
    expect(classifySeverity(15)).toBe('large');
    expect(classifySeverity(20)).toBe('major');
    expect(classifySeverity(-33.3)).toBe('major');
  });

  it('honours overridden thresholds', () => {
    const strict = { ...DEFAULT_SEVERITY_THRESHOLDS, minimal: 0.5, small: 1 };
    expect(classifySeverity(0.7, strict)).toBe('small');
  });
});

describe('comparePrices', () => {
  const current = obs({ priceAgorot: 1200, observedAt: '2026-08-31T08:00:00Z' });

  it('computes a full change for a comparable pair', () => {
    const result = comparePrices(obs({ priceAgorot: 1000, observedAt: '2026-08-28T08:00:00Z' }), current);
    expect(result.comparable).toBe(true);
    if (!result.comparable) return;
    expect(result.absoluteChangeAgorot).toBe(200);
    expect(result.percentageChange).toBe(20);
    expect(result.direction).toBe('increase');
    expect(result.severity).toBe('major');
    expect(result.ageDays).toBe(3);
    expect(result.isRecentComparison).toBe(true);
  });

  it('refuses to compare when there is no previous observation', () => {
    const result = comparePrices(null, current);
    expect(result.comparable).toBe(false);
    if (result.comparable) return;
    expect(result.reason).toBe('no_previous_observation');
    expect(result.currentPriceAgorot).toBe(1200);
  });

  it('refuses to compare a zero baseline', () => {
    const result = comparePrices(obs({ priceAgorot: 0, observedAt: '2026-08-28T08:00:00Z' }), current);
    expect(result.comparable).toBe(false);
    if (!result.comparable) expect(result.reason).toBe('previous_price_is_zero');
  });

  it('refuses to compare different products', () => {
    const other = obs({ priceAgorot: 1000, observedAt: '2026-08-28T08:00:00Z', productId: 'p-tea-200g' });
    const result = comparePrices(other, current);
    expect(result.comparable).toBe(false);
    if (!result.comparable) expect(result.reason).toBe('product_identity_changed');
  });

  it('refuses to compare different package sizes', () => {
    const other = obs({ priceAgorot: 1000, observedAt: '2026-08-28T08:00:00Z', packageSizeBaseUnits: 400 });
    const result = comparePrices(other, current);
    expect(result.comparable).toBe(false);
    if (!result.comparable) expect(result.reason).toBe('package_size_changed');
  });

  it('refuses to compare unparseable timestamps', () => {
    const other = obs({ priceAgorot: 1000, observedAt: 'not-a-date' });
    const result = comparePrices(other, current);
    expect(result.comparable).toBe(false);
    if (!result.comparable) expect(result.reason).toBe('invalid_timestamp');
  });

  it('marks a stale comparison so the UI cannot claim "changed today"', () => {
    const old = obs({ priceAgorot: 1000, observedAt: '2026-07-01T08:00:00Z' });
    const result = comparePrices(old, current);
    expect(result.comparable).toBe(true);
    if (!result.comparable) return;
    expect(result.ageDays).toBe(61);
    expect(result.isRecentComparison).toBe(false);
  });

  it('separates a promotion starting from an ordinary price drop', () => {
    const regular = obs({ priceAgorot: 2000, observedAt: '2026-08-24T08:00:00Z' });
    const promo = obs({ priceAgorot: 1500, observedAt: '2026-08-31T08:00:00Z', promotionId: 'promo-1' });
    const started = comparePrices(regular, promo);
    expect(started.comparable).toBe(true);
    if (started.comparable) {
      expect(started.promotionTransition).toBe('promotion_started');
      expect(started.percentageChange).toBe(-25);
    }
    const ended = comparePrices(promo, obs({ priceAgorot: 2000, observedAt: '2026-09-07T08:00:00Z' }));
    expect(ended.comparable).toBe(true);
    if (ended.comparable) {
      expect(ended.promotionTransition).toBe('promotion_ended');
      expect(ended.percentageChange).toBe(33.3);
    }
  });

  it('reports a membership transition', () => {
    const regular = obs({ priceAgorot: 1500, observedAt: '2026-08-24T08:00:00Z' });
    const member = obs({ priceAgorot: 1100, observedAt: '2026-08-31T08:00:00Z', isMemberPrice: true });
    const result = comparePrices(regular, member);
    if (result.comparable) expect(result.membershipTransition).toBe('member_price_started');
  });

  it('carries the lowest confidence of the pair', () => {
    const prev = obs({ priceAgorot: 1000, observedAt: '2026-08-28T08:00:00Z', confidence: 0.6 });
    const result = comparePrices(prev, current);
    if (result.comparable) expect(result.confidence).toBe(0.6);
  });
});

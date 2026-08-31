import { describe, expect, it } from 'vitest';
import {
  adviseOnPurchase,
  computeBaseline,
  priceAsOf,
  windowAverage,
  type HistoricalPoint,
} from './baseline';

function point(priceAgorot: number, daysAgo: number, isPromotional = false): HistoricalPoint {
  const observedAt = new Date(Date.parse('2026-08-31T00:00:00Z') - daysAgo * 86_400_000).toISOString();
  return { priceAgorot, observedAt, isPromotional, isMemberPrice: false, chainId: 'rami-levy', source: 'test' };
}

describe('computeBaseline', () => {
  it('reports no baseline without enough observations', () => {
    const baseline = computeBaseline([point(2400, 3)]);
    expect(baseline.hasEnoughData).toBe(false);
    expect(baseline.observationCount).toBe(1);
  });

  it('summarises the user history from stored observations only', () => {
    const history = [point(2600, 60), point(2400, 40), point(2500, 20), point(2100, 10), point(3300, 2)];
    const baseline = computeBaseline(history);
    expect(baseline.hasEnoughData).toBe(true);
    expect(baseline.usualPriceAgorot).toBe(2500);
    expect(baseline.lowestObservedAgorot).toBe(2100);
    expect(baseline.highestObservedAgorot).toBe(3300);
    expect(baseline.averagePriceAgorot).toBe(2580);
    expect(baseline.historySpanDays).toBe(58);
    expect(baseline.usualRangeAgorot).toEqual({ low: 2400, high: 2600 });
  });

  it('excludes promotional prices from the usual price', () => {
    const history = [point(2500, 40), point(2500, 30), point(2500, 20), point(1500, 10, true), point(1500, 5, true)];
    expect(computeBaseline(history).usualPriceAgorot).toBe(2500);
  });
});

describe('windowAverage', () => {
  const history = [point(2400, 85), point(2600, 45), point(2400, 20), point(2500, 3)];

  it('averages a trailing window from real observations', () => {
    const result = windowAverage(history, 30, '2026-08-31T00:00:00Z');
    expect(result).toMatchObject({ averageAgorot: 2450, sampleCount: 2 });
  });

  it('reports when the window is not fully covered', () => {
    const short = windowAverage([point(2400, 2)], 90, '2026-08-31T00:00:00Z');
    expect(short?.coversFullWindow).toBe(false);
  });

  it('returns null when there is no data in the window', () => {
    expect(windowAverage([point(2400, 200)], 30, '2026-08-31T00:00:00Z')).toBeNull();
  });
});

describe('priceAsOf', () => {
  it('returns the last observation at or before the target, never an interpolation', () => {
    const history = [point(2400, 30), point(2700, 8), point(2500, 1)];
    const sevenDaysAgo = priceAsOf(history, 7, '2026-08-31T00:00:00Z');
    expect(sevenDaysAgo?.priceAgorot).toBe(2700);
  });

  it('returns null when no observation is old enough', () => {
    expect(priceAsOf([point(2400, 1)], 30, '2026-08-31T00:00:00Z')).toBeNull();
  });
});

describe('adviseOnPurchase', () => {
  const history = [point(2600, 60), point(2400, 40), point(2500, 20), point(2100, 10), point(2600, 5)];

  it('says it is a good time when the price is well below the usual price', () => {
    const advice = adviseOnPurchase(2100, history);
    expect(advice.verdict).toBe('good_time_to_buy');
    expect(advice.percentageVsUsual).toBe(-16);
    expect(advice.isLowestObserved).toBe(true);
    expect(advice.reasons).toContain('lowest_observed_price');
  });

  it('suggests waiting when the price is well above the usual price', () => {
    const advice = adviseOnPurchase(3100, history);
    expect(advice.verdict).toBe('consider_waiting');
    expect(advice.percentageVsUsual).toBe(24);
  });

  it('calls a small move normal', () => {
    expect(adviseOnPurchase(2550, history).verdict).toBe('about_normal');
  });

  it('refuses to judge without enough history', () => {
    const advice = adviseOnPurchase(2100, [point(2400, 3)]);
    expect(advice.verdict).toBe('not_enough_data');
    expect(advice.reasons).toContain('insufficient_history');
    expect(advice.percentageVsUsual).toBeNull();
  });

  it('never claims a historical low it cannot support', () => {
    const advice = adviseOnPurchase(1000, [point(2400, 3)]);
    expect(advice.isLowestObserved).toBe(false);
  });
});

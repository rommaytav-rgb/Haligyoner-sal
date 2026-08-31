import { describe, expect, it } from 'vitest';
import { computeSavings, rollupSavings } from './savings';

describe('computeSavings', () => {
  it('reports the specification example with its baseline', () => {
    const result = computeSavings({
      nature: 'potential',
      baseline: 'usual_basket',
      baselineLabel: 'Your usual basket',
      baselineTotalAgorot: 61200,
      comparedTotalAgorot: 53400,
      coveredLineCount: 10,
      comparableCoverage: true,
      measuredAt: '2026-08-31T10:00:00Z',
    });
    expect(result.savingAgorot).toBe(7800);
    expect(result.savingPercentage).toBe(12.7);
    expect(result.baseline).toBe('usual_basket');
    expect(result.nature).toBe('potential');
  });

  it('reports a negative saving rather than hiding it', () => {
    const result = computeSavings({
      nature: 'potential',
      baseline: 'previous_basket',
      baselineLabel: 'Last week',
      baselineTotalAgorot: 50000,
      comparedTotalAgorot: 52000,
      coveredLineCount: 5,
      comparableCoverage: true,
      measuredAt: '2026-08-31T10:00:00Z',
    });
    expect(result.savingAgorot).toBe(-2000);
    expect(result.savingPercentage).toBe(-4);
  });

  it('carries a coverage warning through', () => {
    const result = computeSavings({
      nature: 'potential',
      baseline: 'cheapest_single_store',
      baselineLabel: 'Cheapest single store',
      baselineTotalAgorot: 40000,
      comparedTotalAgorot: 30000,
      coveredLineCount: 6,
      comparableCoverage: false,
      measuredAt: '2026-08-31T10:00:00Z',
    });
    expect(result.comparableCoverage).toBe(false);
  });
});

describe('rollupSavings', () => {
  const events = [
    { nature: 'potential' as const, savingAgorot: 7800, occurredAt: '2026-08-05T10:00:00Z' },
    { nature: 'potential' as const, savingAgorot: 5200, occurredAt: '2026-08-12T10:00:00Z' },
    { nature: 'confirmed' as const, savingAgorot: 4100, occurredAt: '2026-08-19T10:00:00Z' },
    { nature: 'confirmed' as const, savingAgorot: 3000, occurredAt: '2026-07-19T10:00:00Z' },
  ];

  it('keeps potential and confirmed savings separate', () => {
    const rollup = rollupSavings(events, '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
    expect(rollup.potentialAgorot).toBe(13000);
    expect(rollup.confirmedAgorot).toBe(4100);
    expect(rollup.eventCount).toBe(3);
  });

  it('excludes events outside the period', () => {
    const rollup = rollupSavings(events, '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z');
    expect(rollup.eventCount).toBe(0);
  });
});

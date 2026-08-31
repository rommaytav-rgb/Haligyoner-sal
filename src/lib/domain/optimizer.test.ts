import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONVENIENCE,
  optimize,
  planMultiStore,
  planSingleStore,
  type BasketLineRequest,
  type Offer,
  type OptimizationConstraints,
  type StoreBranch,
} from './optimizer';

const branches: StoreBranch[] = [
  {
    branchId: 'a', chainId: 'rami-levy', chainName: 'Rami Levy', branchName: 'A', city: 'Tel Aviv',
    distanceKm: 2, travelTimeMinutes: 8, deliveryFeeAgorot: 2900, deliveryMinimumAgorot: 20000, supportsDelivery: true,
  },
  {
    branchId: 'b', chainId: 'shufersal', chainName: 'Shufersal', branchName: 'B', city: 'Tel Aviv',
    distanceKm: 5, travelTimeMinutes: 15, deliveryFeeAgorot: 3900, deliveryMinimumAgorot: 15000, supportsDelivery: true,
  },
  {
    branchId: 'c', chainId: 'victory', chainName: 'Victory', branchName: 'C', city: 'Ramat Gan',
    distanceKm: 18, travelTimeMinutes: 32, deliveryFeeAgorot: null, deliveryMinimumAgorot: null, supportsDelivery: false,
  },
];

function offer(over: Partial<Offer> & { lineId: string; branchId: string; unitPriceAgorot: number }): Offer {
  const branch = branches.find((b) => b.branchId === over.branchId);
  return {
    productId: `${over.lineId}-exact`,
    displayName: over.lineId,
    brand: null,
    chainId: branch?.chainId ?? 'unknown',
    promotions: [],
    isSubstitute: false,
    substitutionScore: 1,
    observedAt: '2026-08-31T06:00:00Z',
    source: 'test',
    confidence: 1,
    pricePerBaseUnitAgorot: null,
    baseUnit: null,
    ...over,
  };
}

const lines: BasketLineRequest[] = [
  { lineId: 'coffee', productId: 'coffee-exact', displayName: 'Coffee', quantity: 1, locked: false },
  { lineId: 'milk', productId: 'milk-exact', displayName: 'Milk', quantity: 2, locked: false },
  { lineId: 'rice', productId: 'rice-exact', displayName: 'Rice', quantity: 1, locked: false },
];

const offers: Offer[] = [
  offer({ lineId: 'coffee', branchId: 'a', unitPriceAgorot: 3100 }),
  offer({ lineId: 'coffee', branchId: 'b', unitPriceAgorot: 2700 }),
  offer({ lineId: 'coffee', branchId: 'c', unitPriceAgorot: 2300 }),
  offer({ lineId: 'milk', branchId: 'a', unitPriceAgorot: 600 }),
  offer({ lineId: 'milk', branchId: 'b', unitPriceAgorot: 700 }),
  offer({ lineId: 'milk', branchId: 'c', unitPriceAgorot: 650 }),
  offer({ lineId: 'rice', branchId: 'a', unitPriceAgorot: 1100 }),
  offer({ lineId: 'rice', branchId: 'b', unitPriceAgorot: 1400 }),
  offer({ lineId: 'rice', branchId: 'c', unitPriceAgorot: 1000 }),
];

const baseConstraints: OptimizationConstraints = {
  mode: 'best_value',
  maxStores: 3,
  maxDistanceKm: null,
  excludedChainIds: [],
  preferredChainIds: [],
  allowSubstitutions: true,
  minSubstitutionScore: 0.6,
  memberships: new Set<string>(),
  wantsDelivery: false,
  budgetAgorot: null,
  now: '2026-08-31T10:00:00Z',
};

describe('planSingleStore', () => {
  it('prices the basket at every allowed branch and ranks them', () => {
    const plans = planSingleStore(lines, offers, branches, baseConstraints);
    expect(plans).toHaveLength(3);
    const byBranch = new Map(plans.map((p) => [p.legs[0]?.branch.branchId, p.payableTotalAgorot]));
    expect(byBranch.get('a')).toBe(3100 + 1200 + 1100);
    expect(byBranch.get('b')).toBe(2700 + 1400 + 1400);
    expect(byBranch.get('c')).toBe(2300 + 1300 + 1000);
    expect(plans[0]?.legs[0]?.branch.branchId).toBe('c');
  });

  it('excludes chains the user rejected', () => {
    const plans = planSingleStore(lines, offers, branches, { ...baseConstraints, excludedChainIds: ['victory'] });
    expect(plans.map((p) => p.legs[0]?.branch.chainId)).not.toContain('victory');
  });

  it('respects the distance limit', () => {
    const plans = planSingleStore(lines, offers, branches, { ...baseConstraints, maxDistanceKm: 6 });
    expect(plans.map((p) => p.legs[0]?.branch.branchId).sort()).toEqual(['a', 'b']);
  });

  it('ranks coverage above price so a plan cannot win by skipping items', () => {
    const partial = offers.filter((o) => !(o.branchId === 'c' && o.lineId !== 'coffee'));
    const plans = planSingleStore(lines, partial, branches, baseConstraints);
    expect(plans[0]?.coveredLineCount).toBe(3);
    const victory = plans.find((p) => p.legs[0]?.branch.branchId === 'c');
    expect(victory?.unpricedLineIds.sort()).toEqual(['milk', 'rice']);
  });
});

describe('planMultiStore', () => {
  it('splits the basket to the cheapest store per line', () => {
    const plan = planMultiStore(lines, offers, branches, baseConstraints, 2);
    expect(plan).not.toBeNull();
    // Cheapest 2-store split: coffee+rice at Victory (2300 + 1000), milk at Rami Levy (1200).
    expect(plan?.payableTotalAgorot).toBe(2300 + 1000 + 1200);
    expect(plan?.storeCount).toBe(2);
  });

  it('never costs more than the best single store', () => {
    const single = planSingleStore(lines, offers, branches, baseConstraints)[0];
    const multi = planMultiStore(lines, offers, branches, baseConstraints, 3);
    expect(multi?.payableTotalAgorot).toBeLessThanOrEqual(single?.payableTotalAgorot ?? Infinity);
  });
});

describe('optimize', () => {
  it('offers a plan per store count, monotonically non-increasing in cost', () => {
    const outcome = optimize(lines, offers, branches, baseConstraints);
    const totals = outcome.byStoreCount.map((entry) => entry.plan.payableTotalAgorot);
    expect(totals).toHaveLength(3);
    for (let i = 1; i < totals.length; i += 1) {
      expect(totals[i] as number).toBeLessThanOrEqual(totals[i - 1] as number);
    }
  });

  it('prefers a cheaper-with-travel plan for best value over the absolute cheapest', () => {
    const outcome = optimize(lines, offers, branches, baseConstraints);
    expect(outcome.cheapest?.payableTotalAgorot).toBeLessThanOrEqual(
      outcome.bestValue?.payableTotalAgorot ?? Infinity,
    );
    expect(outcome.bestValue?.scoreAgorot).toBeLessThanOrEqual(outcome.cheapest?.scoreAgorot ?? Infinity);
  });

  it('most convenient uses the fewest stores', () => {
    const outcome = optimize(lines, offers, branches, baseConstraints);
    expect(outcome.mostConvenient?.storeCount).toBe(1);
  });

  it('closest prefers the nearest store', () => {
    const outcome = optimize(lines, offers, branches, { ...baseConstraints, mode: 'closest' });
    expect(outcome.closest?.legs.every((leg) => (leg.branch.distanceKm ?? 99) <= 5)).toBe(true);
  });

  it('one-store mode never splits the basket', () => {
    const outcome = optimize(lines, offers, branches, { ...baseConstraints, mode: 'one_store' });
    expect(outcome.recommended?.storeCount).toBe(1);
  });

  it('charges delivery fees and flags orders below the minimum', () => {
    const outcome = optimize(lines, offers, branches, { ...baseConstraints, wantsDelivery: true, mode: 'cheapest' });
    const plan = outcome.recommended;
    expect(plan?.deliveryTotalAgorot).toBeGreaterThan(0);
    expect(plan?.travelCostAgorot).toBe(0);
    expect(plan?.legs.some((leg) => leg.belowDeliveryMinimum)).toBe(true);
  });

  it('reports a coverage gap instead of silently dropping a line', () => {
    const missing = offers.filter((o) => o.lineId !== 'rice');
    const outcome = optimize(lines, missing, branches, baseConstraints);
    expect(outcome.hasCoverageGap).toBe(true);
    expect(outcome.recommended?.unpricedLineIds).toEqual(['rice']);
    expect(outcome.recommended?.coveredLineCount).toBe(2);
    expect(outcome.recommended?.requestedLineCount).toBe(3);
  });
});

describe('substitution policy', () => {
  const substitutionOffers: Offer[] = [
    ...offers,
    offer({
      lineId: 'coffee', branchId: 'a', unitPriceAgorot: 1900, productId: 'coffee-generic',
      displayName: 'Store-brand coffee', isSubstitute: true, substitutionScore: 0.72,
    }),
  ];

  it('uses a substitution when allowed', () => {
    const plans = planSingleStore(lines, substitutionOffers, branches, baseConstraints);
    const rami = plans.find((p) => p.legs[0]?.branch.branchId === 'a');
    expect(rami?.substitutionCount).toBe(1);
    expect(rami?.payableTotalAgorot).toBe(1900 + 1200 + 1100);
  });

  it('never substitutes a locked line', () => {
    const locked = lines.map((l) => (l.lineId === 'coffee' ? { ...l, locked: true } : l));
    const plans = planSingleStore(locked, substitutionOffers, branches, baseConstraints);
    const rami = plans.find((p) => p.legs[0]?.branch.branchId === 'a');
    expect(rami?.substitutionCount).toBe(0);
    expect(rami?.payableTotalAgorot).toBe(3100 + 1200 + 1100);
  });

  it('ignores substitutions below the confidence floor', () => {
    const plans = planSingleStore(lines, substitutionOffers, branches, {
      ...baseConstraints,
      minSubstitutionScore: 0.9,
    });
    const rami = plans.find((p) => p.legs[0]?.branch.branchId === 'a');
    expect(rami?.substitutionCount).toBe(0);
  });

  it('honours excluded brands', () => {
    const branded = [
      ...offers.filter((o) => !(o.lineId === 'coffee' && o.branchId === 'c')),
      offer({ lineId: 'coffee', branchId: 'c', unitPriceAgorot: 2300, brand: 'elite' }),
    ];
    const withExclusion = lines.map((l) =>
      l.lineId === 'coffee' ? { ...l, excludedBrands: ['elite'] } : l,
    );
    const plans = planSingleStore(withExclusion, branded, branches, baseConstraints);
    const victory = plans.find((p) => p.legs[0]?.branch.branchId === 'c');
    expect(victory?.unpricedLineIds).toContain('coffee');
  });
});

describe('convenience model', () => {
  it('prices travel deterministically', () => {
    const plan = planSingleStore(lines, offers, [branches[2] as StoreBranch], baseConstraints)[0];
    // 18 km each way at ₪1.80/km, plus 32 min each way valued at ₪40/hour.
    const expected = Math.round(18 * 2 * DEFAULT_CONVENIENCE.travelCostPerKmAgorot + (32 * 2 * 4000) / 60);
    expect(plan?.travelCostAgorot).toBe(expected);
  });
});

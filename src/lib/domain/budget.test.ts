import { describe, expect, it } from 'vitest';
import { planSingleStore, type BasketLineRequest, type Offer, type OptimizationConstraints, type StoreBranch } from './optimizer';
import { suggestBudgetAdjustments } from './budget';
import type { PromotionContext } from './promotions';

const branches: StoreBranch[] = [
  {
    branchId: 'a', chainId: 'rami-levy', chainName: 'Rami Levy', branchName: 'A', city: 'Tel Aviv',
    distanceKm: 2, travelTimeMinutes: 8, deliveryFeeAgorot: null, deliveryMinimumAgorot: null, supportsDelivery: false,
  },
  {
    branchId: 'b', chainId: 'victory', chainName: 'Victory', branchName: 'B', city: 'Tel Aviv',
    distanceKm: 4, travelTimeMinutes: 12, deliveryFeeAgorot: null, deliveryMinimumAgorot: null, supportsDelivery: false,
  },
];

function offer(over: Partial<Offer> & { lineId: string; branchId: string; unitPriceAgorot: number }): Offer {
  return {
    productId: `${over.lineId}-exact`,
    displayName: over.lineId,
    brand: null,
    chainId: over.branchId === 'a' ? 'rami-levy' : 'victory',
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
  { lineId: 'snacks', productId: 'snacks-exact', displayName: 'Snacks', quantity: 1, locked: false, optional: true },
];

const offers: Offer[] = [
  offer({ lineId: 'coffee', branchId: 'a', unitPriceAgorot: 3100 }),
  offer({
    lineId: 'coffee', branchId: 'b', unitPriceAgorot: 2300, productId: 'coffee-generic',
    displayName: 'Store-brand coffee', isSubstitute: true, substitutionScore: 0.7,
  }),
  offer({ lineId: 'snacks', branchId: 'a', unitPriceAgorot: 1800 }),
];

const constraints: OptimizationConstraints = {
  mode: 'one_store',
  maxStores: 1,
  maxDistanceKm: null,
  excludedChainIds: [],
  preferredChainIds: [],
  allowSubstitutions: true,
  minSubstitutionScore: 0.6,
  memberships: new Set<string>(),
  wantsDelivery: false,
  budgetAgorot: 4000,
  now: '2026-08-31T10:00:00Z',
};

const context: PromotionContext = { memberships: new Set<string>(), now: '2026-08-31T10:00:00Z' };

describe('suggestBudgetAdjustments', () => {
  const plan = planSingleStore(lines, offers, [branches[0] as StoreBranch], constraints)[0];

  it('reports the gap to the budget', () => {
    const outcome = suggestBudgetAdjustments(plan!, lines, offers, 4000, context);
    expect(outcome.currentTotalAgorot).toBe(4900);
    expect(outcome.gapAgorot).toBe(900);
    expect(outcome.withinBudget).toBe(false);
  });

  it('proposes a cheaper alternative and marks it as needing approval', () => {
    const outcome = suggestBudgetAdjustments(plan!, lines, offers, 4000, context);
    const swap = outcome.suggestions.find((s) => s.lineId === 'coffee');
    expect(swap).toMatchObject({ kind: 'cheaper_equivalent', savingAgorot: 800, requiresApproval: true });
  });

  it('offers removing an optional item only as a separate, approvable step', () => {
    const outcome = suggestBudgetAdjustments(plan!, lines, offers, 4000, context);
    const drop = outcome.suggestions.find((s) => s.kind === 'remove_optional_item');
    expect(drop).toMatchObject({ lineId: 'snacks', savingAgorot: 1800, requiresApproval: true });
  });

  it('projects the total if every suggestion is accepted', () => {
    const outcome = suggestBudgetAdjustments(plan!, lines, offers, 4000, context);
    expect(outcome.projectedTotalAgorot).toBe(4900 - 800 - 1800);
    expect(outcome.projectedWithinBudget).toBe(true);
  });

  it('never proposes swapping a locked line', () => {
    const locked = lines.map((l) => (l.lineId === 'coffee' ? { ...l, locked: true } : l));
    const lockedPlan = planSingleStore(locked, offers, [branches[0] as StoreBranch], constraints)[0];
    const outcome = suggestBudgetAdjustments(lockedPlan!, locked, offers, 4000, context);
    expect(outcome.suggestions.some((s) => s.lineId === 'coffee')).toBe(false);
  });

  it('reports a basket already within budget', () => {
    const outcome = suggestBudgetAdjustments(plan!, lines, offers, 6000, context);
    expect(outcome.withinBudget).toBe(true);
  });
});

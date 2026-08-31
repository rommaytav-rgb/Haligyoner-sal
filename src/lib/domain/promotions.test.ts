import { describe, expect, it } from 'vitest';
import { applyPromotion, priceLine, promotionDiscountPercent, type Promotion, type PromotionContext } from './promotions';

const context: PromotionContext = { memberships: new Set(['shufersal']), now: '2026-08-31T10:00:00Z' };

function promo(overrides: Partial<Promotion> & { id: string; kind: Promotion['kind'] }): Promotion {
  return {
    description: overrides.id,
    requiresMembership: false,
    chainId: 'rami-levy',
    startsAt: null,
    endsAt: null,
    source: 'test',
    ...overrides,
  };
}

describe('applyPromotion', () => {
  it('computes 1+1', () => {
    const p = promo({ id: '1+1', kind: 'n_plus_m', buyQuantity: 1, freeQuantity: 1 });
    expect(applyPromotion(1000, 2, p)).toBe(1000);
    expect(applyPromotion(1000, 3, p)).toBe(2000);
    expect(applyPromotion(1000, 4, p)).toBe(2000);
    expect(applyPromotion(1000, 1, p)).toBe(1000);
  });

  it('computes 2+1', () => {
    const p = promo({ id: '2+1', kind: 'n_plus_m', buyQuantity: 2, freeQuantity: 1 });
    expect(applyPromotion(900, 3, p)).toBe(1800);
    expect(applyPromotion(900, 6, p)).toBe(3600);
    expect(applyPromotion(900, 4, p)).toBe(2700);
  });

  it('computes N for a fixed total', () => {
    const p = promo({ id: '3for20', kind: 'n_for_total', bundleQuantity: 3, bundlePriceAgorot: 2000 });
    expect(applyPromotion(800, 3, p)).toBe(2000);
    expect(applyPromotion(800, 4, p)).toBe(2800);
    expect(applyPromotion(800, 2, p)).toBe(1600);
  });

  it('computes percentage and fixed discounts', () => {
    expect(applyPromotion(2000, 1, promo({ id: 'p25', kind: 'percent_off', percentOff: 25 }))).toBe(1500);
    expect(applyPromotion(2000, 2, promo({ id: 'f5', kind: 'fixed_discount', discountAgorot: 500 }))).toBe(3500);
  });

  it('refuses to compute from incomplete promotion data', () => {
    expect(applyPromotion(1000, 2, promo({ id: 'broken', kind: 'n_plus_m' }))).toBeNull();
    expect(applyPromotion(1000, 2, promo({ id: 'broken2', kind: 'percent_off', percentOff: 0 }))).toBeNull();
  });
});

describe('priceLine', () => {
  it('applies the cheapest qualifying promotion and reports the saving', () => {
    const result = priceLine(2000, 2, [
      promo({ id: '1+1', kind: 'n_plus_m', buyQuantity: 1, freeQuantity: 1 }),
      promo({ id: 'p10', kind: 'percent_off', percentOff: 10 }),
    ], context);
    expect(result.regularTotalAgorot).toBe(4000);
    expect(result.effectiveTotalAgorot).toBe(2000);
    expect(result.savingAgorot).toBe(2000);
    expect(result.appliedPromotionId).toBe('1+1');
  });

  it('never assumes a membership the user has not declared', () => {
    const result = priceLine(1500, 1, [
      promo({ id: 'club', kind: 'member_price', promoUnitPriceAgorot: 1100, requiresMembership: true, chainId: 'carrefour' }),
    ], context);
    expect(result.effectiveTotalAgorot).toBe(1500);
    expect(result.appliedPromotionId).toBeNull();
    expect(result.unappliedPromotions[0]).toMatchObject({ reason: 'requires_membership' });
  });

  it('applies a membership the user has declared', () => {
    const result = priceLine(1500, 1, [
      promo({ id: 'club', kind: 'member_price', promoUnitPriceAgorot: 1100, requiresMembership: true, chainId: 'shufersal' }),
    ], context);
    expect(result.effectiveTotalAgorot).toBe(1100);
    expect(result.appliedPromotionId).toBe('club');
  });

  it('rejects promotions outside their date window and reports why', () => {
    const expired = priceLine(1000, 1, [
      promo({ id: 'old', kind: 'percent_off', percentOff: 50, endsAt: '2026-08-01T00:00:00Z' }),
    ], context);
    expect(expired.effectiveTotalAgorot).toBe(1000);
    expect(expired.unappliedPromotions[0]).toMatchObject({ reason: 'expired' });

    const future = priceLine(1000, 1, [
      promo({ id: 'future', kind: 'percent_off', percentOff: 50, startsAt: '2026-09-15T00:00:00Z' }),
    ], context);
    expect(future.unappliedPromotions[0]).toMatchObject({ reason: 'not_started' });
  });

  it('rejects a promotion below its minimum quantity', () => {
    const result = priceLine(1000, 1, [
      promo({ id: 'min3', kind: 'percent_off', percentOff: 30, minQuantity: 3 }),
    ], context);
    expect(result.effectiveTotalAgorot).toBe(1000);
    expect(result.unappliedPromotions[0]).toMatchObject({ reason: 'below_min_quantity' });
  });

  it('does not stack promotions', () => {
    const result = priceLine(1000, 4, [
      promo({ id: 'a', kind: 'percent_off', percentOff: 20 }),
      promo({ id: 'b', kind: 'fixed_discount', discountAgorot: 500 }),
    ], context);
    // 20% off 4000 = 3200, which beats 4000 - 500 = 3500; neither stacks.
    expect(result.effectiveTotalAgorot).toBe(3200);
  });
});

describe('promotionDiscountPercent', () => {
  it('reports the specification example of ₪20 -> ₪15', () => {
    expect(promotionDiscountPercent(2000, 1500)).toBe(-25);
  });
});

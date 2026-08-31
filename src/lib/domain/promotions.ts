/**
 * Promotion engine — computes the effective cost of buying N units of an item.
 *
 * Rules:
 *  - A promotion is applied only when we hold evidence that the user qualifies
 *    (membership, quantity threshold, active date window).
 *  - Member prices are never used as "the user's price" unless the user has
 *    declared that membership.
 *  - The regular price is always reported alongside, so the UI can show what
 *    the promotion is measured against.
 */

import { multiplyAgorot, type Agorot } from './money';
import { roundTo } from './price-change';

export type PromotionKind =
  | 'n_plus_m' // 1+1, 2+1
  | 'n_for_total' // 3 for ₪20
  | 'percent_off'
  | 'fixed_discount'
  | 'unit_price_override' // discounted unit price, often quantity-gated
  | 'member_price';

export interface Promotion {
  id: string;
  kind: PromotionKind;
  description: string;
  /** Buy `buyQuantity`, get `freeQuantity` free (n_plus_m). */
  buyQuantity?: number;
  freeQuantity?: number;
  /** Bundle: `bundleQuantity` items for `bundlePriceAgorot` (n_for_total). */
  bundleQuantity?: number;
  bundlePriceAgorot?: Agorot;
  /** Percentage off the regular price, 0..100 (percent_off). */
  percentOff?: number;
  /** Flat discount off the line total (fixed_discount). */
  discountAgorot?: Agorot;
  /** Overridden per-unit price (unit_price_override / member_price). */
  promoUnitPriceAgorot?: Agorot;
  /** Minimum units that must be purchased for the promotion to apply. */
  minQuantity?: number;
  /** Whether a club membership in the chain is required. */
  requiresMembership: boolean;
  chainId: string;
  startsAt: string | null;
  endsAt: string | null;
  source: string;
}

export interface PromotionContext {
  /** Chains where the user has declared a club membership. */
  memberships: ReadonlySet<string>;
  /** Evaluation time, ISO 8601. */
  now: string;
}

export type PromotionIneligibility =
  | 'requires_membership'
  | 'below_min_quantity'
  | 'not_started'
  | 'expired'
  | 'incomplete_promotion_data';

export interface PricedLine {
  /** What the line costs at the plain shelf price. */
  regularTotalAgorot: Agorot;
  /** What the line costs after every promotion the user actually qualifies for. */
  effectiveTotalAgorot: Agorot;
  savingAgorot: Agorot;
  appliedPromotionId: string | null;
  appliedPromotionDescription: string | null;
  /** Promotions we saw but did not apply, with the reason. Shown, never hidden. */
  unappliedPromotions: Array<{ promotionId: string; description: string; reason: PromotionIneligibility }>;
}

function isActive(promotion: Promotion, now: string): PromotionIneligibility | null {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) return null; // cannot judge — treat window as unconstrained
  if (promotion.startsAt) {
    const startMs = Date.parse(promotion.startsAt);
    if (!Number.isNaN(startMs) && nowMs < startMs) return 'not_started';
  }
  if (promotion.endsAt) {
    const endMs = Date.parse(promotion.endsAt);
    if (!Number.isNaN(endMs) && nowMs > endMs) return 'expired';
  }
  return null;
}

/**
 * Cost of `quantity` units under one promotion.
 * Returns null when the promotion's data is too incomplete to compute honestly.
 */
export function applyPromotion(
  regularUnitPriceAgorot: Agorot,
  quantity: number,
  promotion: Promotion,
): Agorot | null {
  switch (promotion.kind) {
    case 'n_plus_m': {
      const buy = promotion.buyQuantity;
      const free = promotion.freeQuantity;
      if (!buy || !free || buy <= 0 || free <= 0) return null;
      const groupSize = buy + free;
      const fullGroups = Math.floor(quantity / groupSize);
      const remainder = quantity % groupSize;
      const paidUnits = fullGroups * buy + Math.min(remainder, buy);
      return multiplyAgorot(regularUnitPriceAgorot, paidUnits);
    }
    case 'n_for_total': {
      const bundleQty = promotion.bundleQuantity;
      const bundlePrice = promotion.bundlePriceAgorot;
      if (!bundleQty || bundleQty <= 0 || bundlePrice === undefined) return null;
      const bundles = Math.floor(quantity / bundleQty);
      const remainder = quantity % bundleQty;
      return bundles * bundlePrice + multiplyAgorot(regularUnitPriceAgorot, remainder);
    }
    case 'percent_off': {
      const pct = promotion.percentOff;
      if (pct === undefined || pct <= 0 || pct > 100) return null;
      const gross = multiplyAgorot(regularUnitPriceAgorot, quantity);
      return Math.round(gross * (1 - pct / 100));
    }
    case 'fixed_discount': {
      const discount = promotion.discountAgorot;
      if (discount === undefined || discount <= 0) return null;
      const gross = multiplyAgorot(regularUnitPriceAgorot, quantity);
      return Math.max(0, gross - discount);
    }
    case 'unit_price_override':
    case 'member_price': {
      const unit = promotion.promoUnitPriceAgorot;
      if (unit === undefined || unit < 0) return null;
      return multiplyAgorot(unit, quantity);
    }
    default:
      return null;
  }
}

/**
 * Prices one basket line, choosing the cheapest promotion the user qualifies for.
 * Promotions are never stacked: Israeli chains apply one promotion per line, and
 * assuming otherwise would understate the real checkout total.
 */
export function priceLine(
  regularUnitPriceAgorot: Agorot,
  quantity: number,
  promotions: readonly Promotion[],
  context: PromotionContext,
): PricedLine {
  const regularTotal = multiplyAgorot(regularUnitPriceAgorot, quantity);
  let bestTotal = regularTotal;
  let bestPromotion: Promotion | null = null;
  const unapplied: PricedLine['unappliedPromotions'] = [];

  for (const promotion of promotions) {
    if (promotion.requiresMembership && !context.memberships.has(promotion.chainId)) {
      unapplied.push({ promotionId: promotion.id, description: promotion.description, reason: 'requires_membership' });
      continue;
    }
    if (promotion.minQuantity !== undefined && quantity < promotion.minQuantity) {
      unapplied.push({ promotionId: promotion.id, description: promotion.description, reason: 'below_min_quantity' });
      continue;
    }
    const windowIssue = isActive(promotion, context.now);
    if (windowIssue) {
      unapplied.push({ promotionId: promotion.id, description: promotion.description, reason: windowIssue });
      continue;
    }
    const total = applyPromotion(regularUnitPriceAgorot, quantity, promotion);
    if (total === null) {
      unapplied.push({
        promotionId: promotion.id,
        description: promotion.description,
        reason: 'incomplete_promotion_data',
      });
      continue;
    }
    if (total < bestTotal) {
      bestTotal = total;
      bestPromotion = promotion;
    }
  }

  return {
    regularTotalAgorot: regularTotal,
    effectiveTotalAgorot: bestTotal,
    savingAgorot: regularTotal - bestTotal,
    appliedPromotionId: bestPromotion?.id ?? null,
    appliedPromotionDescription: bestPromotion?.description ?? null,
    unappliedPromotions: unapplied,
  };
}

/** Discount percentage of a promotion relative to the regular price, for display. */
export function promotionDiscountPercent(regularTotal: Agorot, effectiveTotal: Agorot): number | null {
  if (regularTotal <= 0) return null;
  return roundTo(((effectiveTotal - regularTotal) / regularTotal) * 100, 1);
}

/**
 * Smart budget assistant.
 *
 * Produces *proposals* to bring a plan under a budget. Nothing here mutates the
 * user's basket: every meaningful change is returned as a suggestion for the
 * user to approve, per the product rule that preferences are never silently
 * changed.
 */

import { type Agorot } from './money';
import type { BasketLineRequest, Offer, ShoppingPlan } from './optimizer';
import { lineCost } from './optimizer';
import { priceLine, type PromotionContext } from './promotions';

export type BudgetSuggestionKind =
  | 'cheaper_equivalent'
  | 'promotion_available'
  | 'different_package_size'
  | 'remove_optional_item';

export interface BudgetSuggestion {
  kind: BudgetSuggestionKind;
  lineId: string;
  displayName: string;
  currentCostAgorot: Agorot;
  proposedCostAgorot: Agorot;
  savingAgorot: Agorot;
  /** The offer backing this suggestion, when there is one. */
  proposedProductId: string | null;
  proposedDisplayName: string | null;
  chainId: string | null;
  branchId: string | null;
  /** True when accepting this changes what the user actually gets. */
  requiresApproval: boolean;
  note: string;
}

export interface BudgetOutcome {
  budgetAgorot: Agorot;
  currentTotalAgorot: Agorot;
  gapAgorot: Agorot;
  withinBudget: boolean;
  suggestions: BudgetSuggestion[];
  /** Total if every suggestion is accepted. */
  projectedTotalAgorot: Agorot;
  projectedWithinBudget: boolean;
}

/**
 * Ranks money-saving swaps for a plan under a budget.
 * Suggestions are additive and independent — each is measured against the plan
 * as it stands, and `projectedTotalAgorot` applies them all at once.
 */
export function suggestBudgetAdjustments(
  plan: ShoppingPlan,
  lines: readonly BasketLineRequest[],
  offers: readonly Offer[],
  budgetAgorot: Agorot,
  context: PromotionContext,
): BudgetOutcome {
  const current = plan.payableTotalAgorot;
  const suggestions: BudgetSuggestion[] = [];
  const linesById = new Map(lines.map((l) => [l.lineId, l]));

  const planned = plan.legs.flatMap((leg) => leg.lines);
  for (const planLine of planned) {
    const request = linesById.get(planLine.lineId);
    if (!request) continue;
    const currentCost = planLine.pricing.effectiveTotalAgorot;

    // Look for any cheaper offer for this line anywhere the user is allowed to shop.
    let bestAlternative: { offer: Offer; total: Agorot } | null = null;
    for (const offer of offers) {
      if (offer.lineId !== planLine.lineId) continue;
      if (offer.productId === planLine.offeredProductId && offer.branchId === planLine.branchId) continue;
      if (offer.isSubstitute && request.locked) continue;
      const priced = priceLine(offer.unitPriceAgorot, request.quantity, offer.promotions, context);
      if (priced.effectiveTotalAgorot >= currentCost) continue;
      if (!bestAlternative || priced.effectiveTotalAgorot < bestAlternative.total) {
        bestAlternative = { offer, total: priced.effectiveTotalAgorot };
      }
    }

    if (bestAlternative) {
      const { offer, total } = bestAlternative;
      const sameProduct = offer.productId === planLine.offeredProductId;
      const differentSize =
        offer.baseUnit !== null &&
        planLine.offeredProductId !== offer.productId &&
        offer.pricePerBaseUnitAgorot !== null;
      const kind: BudgetSuggestionKind = sameProduct
        ? 'promotion_available'
        : differentSize
          ? 'different_package_size'
          : 'cheaper_equivalent';
      suggestions.push({
        kind,
        lineId: planLine.lineId,
        displayName: planLine.displayName,
        currentCostAgorot: currentCost,
        proposedCostAgorot: total,
        savingAgorot: currentCost - total,
        proposedProductId: offer.productId,
        proposedDisplayName: offer.displayName,
        chainId: offer.chainId,
        branchId: offer.branchId,
        requiresApproval: !sameProduct,
        note: sameProduct ? 'same_product_cheaper_elsewhere' : 'alternative_product',
      });
    }
  }

  // Optional items are the last resort and always require approval.
  for (const line of lines) {
    if (!line.optional) continue;
    const cost = lineCost(plan, line.lineId);
    if (cost === null || cost <= 0) continue;
    if (suggestions.some((s) => s.lineId === line.lineId)) continue;
    suggestions.push({
      kind: 'remove_optional_item',
      lineId: line.lineId,
      displayName: line.displayName,
      currentCostAgorot: cost,
      proposedCostAgorot: 0,
      savingAgorot: cost,
      proposedProductId: null,
      proposedDisplayName: null,
      chainId: null,
      branchId: null,
      requiresApproval: true,
      note: 'optional_item',
    });
  }

  suggestions.sort((a, b) => b.savingAgorot - a.savingAgorot);
  const totalSaving = suggestions.reduce((acc, s) => acc + s.savingAgorot, 0);
  const projected = current - totalSaving;

  return {
    budgetAgorot,
    currentTotalAgorot: current,
    gapAgorot: current - budgetAgorot,
    withinBudget: current <= budgetAgorot,
    suggestions,
    projectedTotalAgorot: projected,
    projectedWithinBudget: projected <= budgetAgorot,
  };
}

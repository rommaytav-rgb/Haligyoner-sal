/**
 * Optimization engine.
 *
 * Given a personal basket and the price observations we could actually verify,
 * it produces single-store, multi-store and best-value shopping plans under the
 * user's constraints (distance, store count, excluded chains, substitution
 * policy, delivery, memberships).
 *
 * Two invariants hold throughout:
 *  1. A line is only priced from a real observation. Missing data produces an
 *     unpriced line, never an estimate.
 *  2. Every total reports the coverage it was computed over, so a cheaper plan
 *     that simply skipped items can never masquerade as a better plan.
 */

import { multiplyAgorot, sumAgorot, type Agorot } from './money';
import { priceLine, type PricedLine, type Promotion, type PromotionContext } from './promotions';
import { roundTo } from './price-change';

export type OptimizationMode = 'cheapest' | 'best_value' | 'most_convenient' | 'closest' | 'one_store';

export interface BasketLineRequest {
  lineId: string;
  /** The exact product the user wants. */
  productId: string;
  displayName: string;
  quantity: number;
  /** When true, the optimizer may never swap this product for another. */
  locked: boolean;
  /** Brands the user refuses. Offers from these brands are dropped. */
  excludedBrands?: readonly string[];
  /** Optional: the user marked this item as skippable under a budget squeeze. */
  optional?: boolean;
}

export interface Offer {
  lineId: string;
  /** The product actually being offered — may differ from the requested one. */
  productId: string;
  displayName: string;
  brand: string | null;
  chainId: string;
  branchId: string;
  unitPriceAgorot: Agorot;
  promotions: readonly Promotion[];
  /** Populated when this offer is a substitution rather than the exact product. */
  isSubstitute: boolean;
  /** 0..1 similarity to the requested product, for substitutions. */
  substitutionScore: number;
  observedAt: string;
  source: string;
  confidence: number;
  /** Per-base-unit price, when the package size could be parsed. */
  pricePerBaseUnitAgorot: number | null;
  baseUnit: string | null;
}

export interface StoreBranch {
  branchId: string;
  chainId: string;
  chainName: string;
  branchName: string;
  city: string | null;
  distanceKm: number | null;
  travelTimeMinutes: number | null;
  deliveryFeeAgorot: Agorot | null;
  deliveryMinimumAgorot: Agorot | null;
  supportsDelivery: boolean;
}

export interface OptimizationConstraints {
  mode: OptimizationMode;
  maxStores: number;
  maxDistanceKm: number | null;
  excludedChainIds: readonly string[];
  preferredChainIds: readonly string[];
  allowSubstitutions: boolean;
  minSubstitutionScore: number;
  memberships: ReadonlySet<string>;
  wantsDelivery: boolean;
  /** Budget ceiling in agorot, when the user set one. */
  budgetAgorot: Agorot | null;
  now: string;
}

/** Convenience is priced explicitly so "best value" is arithmetic, not vibes. */
export interface ConvenienceModel {
  /** Cost attributed to driving one kilometre (fuel + wear), in agorot. */
  travelCostPerKmAgorot: number;
  /** Value the user places on an hour of their time, in agorot. */
  timeValuePerHourAgorot: number;
  /** Flat penalty for each store beyond the first — parking, queueing, context switching. */
  extraStorePenaltyAgorot: number;
}

export const DEFAULT_CONVENIENCE: ConvenienceModel = {
  travelCostPerKmAgorot: 180, // ₪1.80 per km
  timeValuePerHourAgorot: 4000, // ₪40 per hour
  extraStorePenaltyAgorot: 1200, // ₪12 per extra stop
};

export interface PlanLine {
  lineId: string;
  requestedProductId: string;
  offeredProductId: string;
  displayName: string;
  quantity: number;
  chainId: string;
  branchId: string;
  unitPriceAgorot: Agorot;
  pricing: PricedLine;
  isSubstitute: boolean;
  substitutionScore: number;
  observedAt: string;
  source: string;
  confidence: number;
}

export interface StoreLeg {
  branch: StoreBranch;
  lines: PlanLine[];
  subtotalAgorot: Agorot;
  deliveryFeeAgorot: Agorot;
  /** True when a delivery order sits below the store's minimum. */
  belowDeliveryMinimum: boolean;
}

export interface ShoppingPlan {
  mode: OptimizationMode;
  legs: StoreLeg[];
  /** Cost of goods after promotions, excluding delivery and travel. */
  goodsTotalAgorot: Agorot;
  deliveryTotalAgorot: Agorot;
  /** Modelled travel cost — an estimate of effort, clearly separated from goods. */
  travelCostAgorot: number;
  /** goods + delivery. What the user actually pays at the tills. */
  payableTotalAgorot: Agorot;
  /** payable + modelled travel + store-count penalty. Used for ranking only. */
  scoreAgorot: number;
  storeCount: number;
  totalDistanceKm: number | null;
  totalTravelMinutes: number | null;
  /** Lines we could not price from verified data. */
  unpricedLineIds: string[];
  coveredLineCount: number;
  requestedLineCount: number;
  substitutionCount: number;
  promotionSavingAgorot: Agorot;
}

function offerAllowed(offer: Offer, line: BasketLineRequest, constraints: OptimizationConstraints): boolean {
  if (constraints.excludedChainIds.includes(offer.chainId)) return false;
  if (offer.isSubstitute) {
    if (line.locked || !constraints.allowSubstitutions) return false;
    if (offer.substitutionScore < constraints.minSubstitutionScore) return false;
  }
  if (line.excludedBrands && offer.brand && line.excludedBrands.includes(offer.brand)) return false;
  return true;
}

function branchAllowed(branch: StoreBranch, constraints: OptimizationConstraints): boolean {
  if (constraints.excludedChainIds.includes(branch.chainId)) return false;
  if (constraints.wantsDelivery && !branch.supportsDelivery) return false;
  if (
    constraints.maxDistanceKm !== null &&
    branch.distanceKm !== null &&
    branch.distanceKm > constraints.maxDistanceKm
  ) {
    return false;
  }
  return true;
}

function buildPlanLine(
  line: BasketLineRequest,
  offer: Offer,
  context: PromotionContext,
): PlanLine {
  return {
    lineId: line.lineId,
    requestedProductId: line.productId,
    offeredProductId: offer.productId,
    displayName: offer.displayName,
    quantity: line.quantity,
    chainId: offer.chainId,
    branchId: offer.branchId,
    unitPriceAgorot: offer.unitPriceAgorot,
    pricing: priceLine(offer.unitPriceAgorot, line.quantity, offer.promotions, context),
    isSubstitute: offer.isSubstitute,
    substitutionScore: offer.substitutionScore,
    observedAt: offer.observedAt,
    source: offer.source,
    confidence: offer.confidence,
  };
}

/**
 * Cheapest offer for one line at one branch.
 * Ties break toward the exact product over a substitute, then toward the more
 * recent observation — never arbitrarily.
 */
function bestOfferAtBranch(
  line: BasketLineRequest,
  offers: readonly Offer[],
  branchId: string,
  constraints: OptimizationConstraints,
  context: PromotionContext,
): PlanLine | null {
  let best: PlanLine | null = null;
  for (const offer of offers) {
    if (offer.lineId !== line.lineId) continue;
    if (offer.branchId !== branchId) continue;
    if (!offerAllowed(offer, line, constraints)) continue;
    const candidate = buildPlanLine(line, offer, context);
    if (!best) {
      best = candidate;
      continue;
    }
    const cheaper = candidate.pricing.effectiveTotalAgorot < best.pricing.effectiveTotalAgorot;
    const equal = candidate.pricing.effectiveTotalAgorot === best.pricing.effectiveTotalAgorot;
    if (cheaper) best = candidate;
    else if (equal && best.isSubstitute && !candidate.isSubstitute) best = candidate;
    else if (equal && best.isSubstitute === candidate.isSubstitute && candidate.observedAt > best.observedAt) {
      best = candidate;
    }
  }
  return best;
}

function assemblePlan(
  mode: OptimizationMode,
  assignments: readonly PlanLine[],
  unpricedLineIds: readonly string[],
  requestedLineCount: number,
  branchesById: ReadonlyMap<string, StoreBranch>,
  constraints: OptimizationConstraints,
  convenience: ConvenienceModel,
): ShoppingPlan {
  const byBranch = new Map<string, PlanLine[]>();
  for (const line of assignments) {
    const existing = byBranch.get(line.branchId);
    if (existing) existing.push(line);
    else byBranch.set(line.branchId, [line]);
  }

  const legs: StoreLeg[] = [];
  let deliveryTotal = 0;
  for (const [branchId, lines] of byBranch) {
    const branch = branchesById.get(branchId);
    if (!branch) continue;
    const subtotal = sumAgorot(lines.map((l) => l.pricing.effectiveTotalAgorot));
    const wantsDelivery = constraints.wantsDelivery && branch.supportsDelivery;
    const fee = wantsDelivery ? (branch.deliveryFeeAgorot ?? 0) : 0;
    const belowMinimum =
      wantsDelivery && branch.deliveryMinimumAgorot !== null && subtotal < branch.deliveryMinimumAgorot;
    deliveryTotal += fee;
    legs.push({ branch, lines, subtotalAgorot: subtotal, deliveryFeeAgorot: fee, belowDeliveryMinimum: belowMinimum });
  }

  legs.sort((a, b) => b.subtotalAgorot - a.subtotalAgorot);

  const goodsTotal = sumAgorot(legs.map((l) => l.subtotalAgorot));
  const promotionSaving = sumAgorot(assignments.map((l) => l.pricing.savingAgorot));

  const distances = legs.map((l) => l.branch.distanceKm).filter((d): d is number => d !== null);
  const minutes = legs.map((l) => l.branch.travelTimeMinutes).filter((m): m is number => m !== null);
  const totalDistanceKm = distances.length === legs.length && legs.length > 0
    ? roundTo(distances.reduce((a, b) => a + b, 0), 2)
    : null;
  const totalTravelMinutes = minutes.length === legs.length && legs.length > 0
    ? minutes.reduce((a, b) => a + b, 0)
    : null;

  // Delivery replaces travel entirely; otherwise the user drives to each store.
  const travelCost = constraints.wantsDelivery
    ? 0
    : Math.round(
        (totalDistanceKm ?? 0) * 2 * convenience.travelCostPerKmAgorot +
          ((totalTravelMinutes ?? 0) * 2 * convenience.timeValuePerHourAgorot) / 60,
      );

  const extraStorePenalty = Math.max(0, legs.length - 1) * convenience.extraStorePenaltyAgorot;
  const payable = goodsTotal + deliveryTotal;

  return {
    mode,
    legs,
    goodsTotalAgorot: goodsTotal,
    deliveryTotalAgorot: deliveryTotal,
    travelCostAgorot: travelCost,
    payableTotalAgorot: payable,
    scoreAgorot: payable + travelCost + extraStorePenalty,
    storeCount: legs.length,
    totalDistanceKm,
    totalTravelMinutes,
    unpricedLineIds: [...unpricedLineIds],
    coveredLineCount: assignments.length,
    requestedLineCount,
    substitutionCount: assignments.filter((l) => l.isSubstitute).length,
    promotionSavingAgorot: promotionSaving,
  };
}

/** Every single-store plan, ranked. Coverage first, then cost — never cost alone. */
export function planSingleStore(
  lines: readonly BasketLineRequest[],
  offers: readonly Offer[],
  branches: readonly StoreBranch[],
  constraints: OptimizationConstraints,
  convenience: ConvenienceModel = DEFAULT_CONVENIENCE,
): ShoppingPlan[] {
  const context: PromotionContext = { memberships: constraints.memberships, now: constraints.now };
  const branchesById = new Map(branches.map((b) => [b.branchId, b]));
  const plans: ShoppingPlan[] = [];

  for (const branch of branches) {
    if (!branchAllowed(branch, constraints)) continue;
    const assignments: PlanLine[] = [];
    const unpriced: string[] = [];
    for (const line of lines) {
      const best = bestOfferAtBranch(line, offers, branch.branchId, constraints, context);
      if (best) assignments.push(best);
      else unpriced.push(line.lineId);
    }
    if (assignments.length === 0) continue;
    plans.push(
      assemblePlan('one_store', assignments, unpriced, lines.length, branchesById, constraints, convenience),
    );
  }

  plans.sort((a, b) => b.coveredLineCount - a.coveredLineCount || a.payableTotalAgorot - b.payableTotalAgorot);
  return plans;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k <= 0 || k > items.length) return [];
  const result: T[][] = [];
  const current: T[] = [];
  const walk = (start: number) => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      current.push(items[i] as T);
      walk(i + 1);
      current.pop();
    }
  };
  walk(0);
  return result;
}

/** Branches considered when searching multi-store combinations. Keeps the search bounded. */
export const MULTI_STORE_CANDIDATE_LIMIT = 8;

/**
 * Best plan using exactly `storeCount` stores.
 * Enumerates combinations of the most promising branches and assigns every line
 * to the cheapest store within the combination.
 */
export function planMultiStore(
  lines: readonly BasketLineRequest[],
  offers: readonly Offer[],
  branches: readonly StoreBranch[],
  constraints: OptimizationConstraints,
  storeCount: number,
  convenience: ConvenienceModel = DEFAULT_CONVENIENCE,
  candidateLimit = MULTI_STORE_CANDIDATE_LIMIT,
): ShoppingPlan | null {
  if (storeCount < 1) return null;
  const context: PromotionContext = { memberships: constraints.memberships, now: constraints.now };
  const allowed = branches.filter((b) => branchAllowed(b, constraints));
  if (allowed.length === 0) return null;

  // Rank candidate branches by their standalone usefulness so the bounded search
  // starts from stores that actually carry the basket cheaply.
  const singles = planSingleStore(lines, offers, allowed, constraints, convenience);
  const ranked = singles.map((p) => p.legs[0]?.branch).filter((b): b is StoreBranch => b !== undefined);
  const pool = ranked.slice(0, candidateLimit);
  if (pool.length === 0) return null;

  const effectiveCount = Math.min(storeCount, pool.length);
  const branchesById = new Map(branches.map((b) => [b.branchId, b]));
  let best: ShoppingPlan | null = null;

  for (const combo of combinations(pool, effectiveCount)) {
    const assignments: PlanLine[] = [];
    const unpriced: string[] = [];
    for (const line of lines) {
      let bestLine: PlanLine | null = null;
      for (const branch of combo) {
        const candidate = bestOfferAtBranch(line, offers, branch.branchId, constraints, context);
        if (!candidate) continue;
        if (!bestLine || candidate.pricing.effectiveTotalAgorot < bestLine.pricing.effectiveTotalAgorot) {
          bestLine = candidate;
        }
      }
      if (bestLine) assignments.push(bestLine);
      else unpriced.push(line.lineId);
    }
    if (assignments.length === 0) continue;

    const plan = assemblePlan(
      'cheapest',
      assignments,
      unpriced,
      lines.length,
      branchesById,
      constraints,
      convenience,
    );
    if (
      !best ||
      plan.coveredLineCount > best.coveredLineCount ||
      (plan.coveredLineCount === best.coveredLineCount && plan.payableTotalAgorot < best.payableTotalAgorot)
    ) {
      best = plan;
    }
  }
  return best;
}

export interface OptimizationOutcome {
  /** Best plan for the requested mode. */
  recommended: ShoppingPlan | null;
  /** One entry per store count, 1..maxStores, for the "1 store / 2 stores / 3 stores" comparison. */
  byStoreCount: Array<{ storeCount: number; plan: ShoppingPlan }>;
  /** All single-store plans, ranked — powers "which store is cheapest for me". */
  singleStorePlans: ShoppingPlan[];
  cheapest: ShoppingPlan | null;
  bestValue: ShoppingPlan | null;
  mostConvenient: ShoppingPlan | null;
  closest: ShoppingPlan | null;
  oneStore: ShoppingPlan | null;
  /** True when at least one basket line had no verified price anywhere. */
  hasCoverageGap: boolean;
}

function pickClosest(plans: readonly ShoppingPlan[]): ShoppingPlan | null {
  const withDistance = plans.filter((p) => p.totalDistanceKm !== null);
  const pool = withDistance.length > 0 ? withDistance : plans;
  return (
    [...pool].sort(
      (a, b) =>
        b.coveredLineCount - a.coveredLineCount ||
        (a.totalDistanceKm ?? Number.POSITIVE_INFINITY) - (b.totalDistanceKm ?? Number.POSITIVE_INFINITY) ||
        a.payableTotalAgorot - b.payableTotalAgorot,
    )[0] ?? null
  );
}

/** Runs every mode once so the UI can present the trade-off honestly. */
export function optimize(
  lines: readonly BasketLineRequest[],
  offers: readonly Offer[],
  branches: readonly StoreBranch[],
  constraints: OptimizationConstraints,
  convenience: ConvenienceModel = DEFAULT_CONVENIENCE,
): OptimizationOutcome {
  const singles = planSingleStore(lines, offers, branches, constraints, convenience);
  const maxStores = Math.max(1, Math.min(constraints.maxStores, 4));
  const byStoreCount: Array<{ storeCount: number; plan: ShoppingPlan }> = [];

  for (let k = 1; k <= maxStores; k += 1) {
    const plan =
      k === 1
        ? singles[0] ?? null
        : planMultiStore(lines, offers, branches, constraints, k, convenience);
    if (plan) byStoreCount.push({ storeCount: k, plan });
  }

  const allPlans = byStoreCount.map((entry) => entry.plan);
  const maxCoverage = allPlans.reduce((acc, p) => Math.max(acc, p.coveredLineCount), 0);
  const fullCoverage = allPlans.filter((p) => p.coveredLineCount === maxCoverage);

  const cheapest =
    [...fullCoverage].sort((a, b) => a.payableTotalAgorot - b.payableTotalAgorot)[0] ?? null;
  const bestValue = [...fullCoverage].sort((a, b) => a.scoreAgorot - b.scoreAgorot)[0] ?? null;
  const mostConvenient =
    [...fullCoverage].sort(
      (a, b) => a.storeCount - b.storeCount || a.payableTotalAgorot - b.payableTotalAgorot,
    )[0] ?? null;
  // "Closest" must be free to pick a nearer store that is not the cheapest, so it
  // searches every single-store plan as well as the cost-optimal multi-store ones.
  const closestPool = [...singles, ...allPlans];
  const closestMaxCoverage = closestPool.reduce((acc, p) => Math.max(acc, p.coveredLineCount), 0);
  const closest = pickClosest(closestPool.filter((p) => p.coveredLineCount === closestMaxCoverage));
  const oneStore = singles[0] ?? null;

  const modeMap: Record<OptimizationMode, ShoppingPlan | null> = {
    cheapest,
    best_value: bestValue,
    most_convenient: mostConvenient,
    closest,
    one_store: oneStore,
  };
  const recommended = modeMap[constraints.mode] ?? bestValue;

  return {
    recommended: recommended ? { ...recommended, mode: constraints.mode } : null,
    byStoreCount,
    singleStorePlans: singles,
    cheapest,
    bestValue,
    mostConvenient,
    closest,
    oneStore,
    hasCoverageGap: allPlans.some((p) => p.unpricedLineIds.length > 0),
  };
}

/** Cost of a plan restricted to a given set of lines, for budget suggestions. */
export function planSubtotalForLines(plan: ShoppingPlan, lineIds: ReadonlySet<string>): Agorot {
  const totals: Agorot[] = [];
  for (const leg of plan.legs) {
    for (const line of leg.lines) {
      if (lineIds.has(line.lineId)) totals.push(line.pricing.effectiveTotalAgorot);
    }
  }
  return sumAgorot(totals);
}

/** Unit cost of one item within a plan, used by the budget assistant. */
export function lineCost(plan: ShoppingPlan, lineId: string): Agorot | null {
  for (const leg of plan.legs) {
    for (const line of leg.lines) {
      if (line.lineId === lineId) return line.pricing.effectiveTotalAgorot;
    }
  }
  return null;
}

export { multiplyAgorot };

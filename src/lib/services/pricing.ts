/**
 * Pricing and optimization service.
 *
 * Assembles verified price observations into optimizer inputs, runs the
 * optimizer, persists the result as a basket snapshot, and records the savings
 * with the baseline they were measured against.
 */

import type { DatabaseSync } from 'node:sqlite';
import { all, get, newId, nowIso, num, optNum, optStr, run, str, toBool, transaction, type Row } from '@/lib/db/client';
import { haversineKm, estimatedTravelMinutes } from '@/lib/domain/geo';
import { computeUnitPrice } from '@/lib/domain/units';
import type { Agorot } from '@/lib/domain/money';
import {
  optimize,
  type BasketLineRequest,
  type ConvenienceModel,
  type Offer,
  type OptimizationConstraints,
  type OptimizationMode,
  type OptimizationOutcome,
  type ShoppingPlan,
  type StoreBranch,
} from '@/lib/domain/optimizer';
import type { Promotion } from '@/lib/domain/promotions';
import { computeSavings, type SavingsResult } from '@/lib/domain/savings';
import type { Basket, BasketItem } from './baskets';
import { getPreferences, listMemberships, type UserPreferences } from './users';
import { findSubstitutes, type CatalogProduct } from './matching';

/** Observations older than this are not used for a live optimization. */
export const MAX_PRICE_AGE_DAYS = 14;

export interface OfferBundle {
  lines: BasketLineRequest[];
  offers: Offer[];
  branches: StoreBranch[];
  /** Basket items with no verified price anywhere. */
  unpricedItemIds: string[];
  /** Items that were never matched to a catalog product at all. */
  unmatchedItemIds: string[];
  oldestObservationAt: string | null;
  newestObservationAt: string | null;
}

interface PriceRow extends Row {
  product_id: string;
  chain_id: string;
  branch_id: string;
  price_agorot: number;
  observed_at: string;
  source: string;
  confidence: number;
  is_member_price: number;
  promotion_id: string | null;
  product_name: string;
  brand_name: string | null;
  package_base_qty: number | null;
  package_base_unit: string | null;
}

function loadBranches(db: DatabaseSync, preferences: UserPreferences): StoreBranch[] {
  const home =
    preferences.homeLatitude !== null && preferences.homeLongitude !== null
      ? { latitude: preferences.homeLatitude, longitude: preferences.homeLongitude }
      : null;

  return all<Row>(
    db,
    `SELECT b.*, c.name_he AS chain_name_he, c.name_en AS chain_name_en
       FROM store_branches b JOIN supermarket_chains c ON c.id = b.chain_id`,
  ).map((row) => {
    const latitude = optNum(row.latitude);
    const longitude = optNum(row.longitude);
    // Distance is a property of the user, so it is computed per request and left
    // null when either the home location or the branch coordinates are unknown.
    const distanceKm =
      home && latitude !== null && longitude !== null ? haversineKm(home, { latitude, longitude }) : null;
    return {
      branchId: str(row.id),
      chainId: str(row.chain_id),
      chainName: str(row.chain_name_he),
      branchName: str(row.name),
      city: optStr(row.city),
      distanceKm,
      travelTimeMinutes: distanceKm === null ? null : estimatedTravelMinutes(distanceKm),
      deliveryFeeAgorot: optNum(row.delivery_fee_agorot),
      deliveryMinimumAgorot: optNum(row.delivery_minimum_agorot),
      supportsDelivery: toBool(row.supports_delivery),
    };
  });
}

function loadPromotionsFor(db: DatabaseSync, productIds: readonly string[]): Map<string, Promotion[]> {
  const map = new Map<string, Promotion[]>();
  if (productIds.length === 0) return map;
  const placeholders = productIds.map(() => '?').join(',');
  const rows = all<Row>(db, `SELECT * FROM promotions WHERE product_id IN (${placeholders})`, [...productIds]);
  for (const row of rows) {
    const productId = str(row.product_id);
    const promotion: Promotion = {
      id: str(row.id),
      kind: str(row.kind) as Promotion['kind'],
      description: str(row.description),
      buyQuantity: optNum(row.buy_quantity) ?? undefined,
      freeQuantity: optNum(row.free_quantity) ?? undefined,
      bundleQuantity: optNum(row.bundle_quantity) ?? undefined,
      bundlePriceAgorot: optNum(row.bundle_price_agorot) ?? undefined,
      percentOff: optNum(row.percent_off) ?? undefined,
      discountAgorot: optNum(row.discount_agorot) ?? undefined,
      promoUnitPriceAgorot: optNum(row.promo_unit_price_agorot) ?? undefined,
      minQuantity: optNum(row.min_quantity) ?? undefined,
      requiresMembership: toBool(row.requires_membership),
      chainId: str(row.chain_id),
      startsAt: optStr(row.starts_at),
      endsAt: optStr(row.ends_at),
      source: str(row.source),
    };
    const key = `${productId}|${optStr(row.branch_id) ?? '*'}`;
    const existing = map.get(key);
    if (existing) existing.push(promotion);
    else map.set(key, [promotion]);
  }
  return map;
}

function loadPrices(db: DatabaseSync, productIds: readonly string[], cutoffIso: string): PriceRow[] {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map(() => '?').join(',');
  return all<PriceRow>(
    db,
    `SELECT pr.*, p.name_he AS product_name, b.name AS brand_name,
            p.package_base_qty, p.package_base_unit
       FROM prices pr
       JOIN products p ON p.id = pr.product_id
       LEFT JOIN brands b ON b.id = p.brand_id
      WHERE pr.product_id IN (${placeholders})
        AND pr.observed_at >= ?`,
    [...productIds, cutoffIso],
  );
}

/**
 * Builds optimizer inputs for a basket.
 *
 * Substitutes are only sourced for lines whose policy allows them, and each
 * substitute carries the similarity score so the optimizer can respect the
 * user's confidence floor.
 */
export function buildOffers(
  db: DatabaseSync,
  basket: Basket,
  preferences: UserPreferences,
  options: { now?: string; maxPriceAgeDays?: number } = {},
): OfferBundle {
  const now = options.now ?? nowIso();
  const maxAge = options.maxPriceAgeDays ?? MAX_PRICE_AGE_DAYS;
  const cutoff = new Date(Date.parse(now) - maxAge * 86_400_000).toISOString();

  const matched = basket.items.filter((item): item is BasketItem & { productId: string } => item.productId !== null);
  const unmatchedItemIds = basket.items.filter((item) => item.productId === null).map((item) => item.id);

  // Each line may accept its own product plus a bounded set of substitutes.
  const substitutesByItem = new Map<string, Array<{ product: CatalogProduct; score: number }>>();
  for (const item of matched) {
    if (item.isLocked || item.substitutionPolicy === 'never' || !preferences.allowSubstitutions) continue;
    const row = get<Row>(
      db,
      `SELECT p.id, p.name_he, p.canonical_name, p.barcode, p.package_base_qty, p.package_base_unit,
              p.package_raw_text, b.name AS brand_name, c.key AS category_key
         FROM products p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?`,
      [item.productId],
    );
    if (!row) continue;
    const product: CatalogProduct = {
      id: str(row.id),
      nameHe: str(row.name_he),
      canonicalName: str(row.canonical_name),
      barcode: optStr(row.barcode),
      brand: optStr(row.brand_name),
      categoryKey: optStr(row.category_key),
      packageBaseQty: optNum(row.package_base_qty),
      packageBaseUnit: (optStr(row.package_base_unit) as CatalogProduct['packageBaseUnit']) ?? null,
      packageRawText: optStr(row.package_raw_text),
    };
    substitutesByItem.set(item.id, findSubstitutes(db, product));
  }

  const allProductIds = new Set<string>();
  for (const item of matched) allProductIds.add(item.productId);
  for (const list of substitutesByItem.values()) for (const s of list) allProductIds.add(s.product.id);

  const priceRows = loadPrices(db, [...allProductIds], cutoff);
  const promotionsByKey = loadPromotionsFor(db, [...allProductIds]);
  const pricesByProduct = new Map<string, PriceRow[]>();
  for (const row of priceRows) {
    const list = pricesByProduct.get(row.product_id);
    if (list) list.push(row);
    else pricesByProduct.set(row.product_id, [row]);
  }

  const lines: BasketLineRequest[] = [];
  const offers: Offer[] = [];
  const unpricedItemIds: string[] = [];
  let oldest: string | null = null;
  let newest: string | null = null;

  const makeOffer = (
    item: BasketItem,
    row: PriceRow,
    isSubstitute: boolean,
    substitutionScore: number,
  ): Offer => {
    const unit =
      row.package_base_qty !== null && row.package_base_unit !== null
        ? computeUnitPrice(row.price_agorot, {
            baseQuantity: row.package_base_qty,
            baseUnit: row.package_base_unit as 'g' | 'ml' | 'unit',
            rawText: '',
            multipack: 1,
          })
        : null;
    const promotions = [
      ...(promotionsByKey.get(`${row.product_id}|${row.branch_id}`) ?? []),
      ...(promotionsByKey.get(`${row.product_id}|*`) ?? []),
    ];
    if (oldest === null || row.observed_at < oldest) oldest = row.observed_at;
    if (newest === null || row.observed_at > newest) newest = row.observed_at;
    return {
      lineId: item.id,
      productId: row.product_id,
      displayName: row.product_name,
      brand: row.brand_name,
      chainId: row.chain_id,
      branchId: row.branch_id,
      unitPriceAgorot: row.price_agorot,
      promotions,
      isSubstitute,
      substitutionScore,
      observedAt: row.observed_at,
      source: row.source,
      confidence: row.confidence,
      pricePerBaseUnitAgorot: unit?.pricePerBaseUnitAgorot ?? null,
      baseUnit: unit?.baseUnit ?? null,
    };
  };

  for (const item of matched) {
    const excludedBrands = [...preferences.dislikedBrands];
    if (item.substitutionPolicy === 'same_brand_only' && item.preferredBrand) {
      // A same-brand-only line accepts substitutes, but only from its own brand.
      const subs = substitutesByItem.get(item.id) ?? [];
      substitutesByItem.set(
        item.id,
        subs.filter((s) => s.product.brand === item.preferredBrand),
      );
    }

    lines.push({
      lineId: item.id,
      productId: item.productId,
      displayName: item.displayName,
      quantity: item.quantity,
      locked: item.isLocked || item.substitutionPolicy === 'never',
      excludedBrands,
      optional: item.isOptional,
    });

    const exact = pricesByProduct.get(item.productId) ?? [];
    for (const row of exact) offers.push(makeOffer(item, row, false, 1));

    for (const substitute of substitutesByItem.get(item.id) ?? []) {
      const rows = pricesByProduct.get(substitute.product.id) ?? [];
      for (const row of rows) offers.push(makeOffer(item, row, true, substitute.score));
    }

    if (!offers.some((o) => o.lineId === item.id)) unpricedItemIds.push(item.id);
  }

  return {
    lines,
    offers,
    branches: loadBranches(db, preferences),
    unpricedItemIds,
    unmatchedItemIds,
    oldestObservationAt: oldest,
    newestObservationAt: newest,
  };
}

export interface OptimizeOptions {
  mode?: OptimizationMode;
  maxStores?: number;
  wantsDelivery?: boolean;
  budgetAgorot?: Agorot | null;
  now?: string;
  /** Persist the resulting plan as a basket snapshot. Defaults to true. */
  persist?: boolean;
}

export interface OptimizationSummary {
  outcome: OptimizationOutcome;
  bundle: OfferBundle;
  constraints: OptimizationConstraints;
  convenience: ConvenienceModel;
  savings: SavingsResult[];
  snapshotId: string | null;
  previousSnapshotId: string | null;
  dataFreshness: {
    oldestObservationAt: string | null;
    newestObservationAt: string | null;
    maxPriceAgeDays: number;
  };
}

export function buildConstraints(
  preferences: UserPreferences,
  memberships: readonly string[],
  options: OptimizeOptions = {},
): OptimizationConstraints {
  return {
    mode: options.mode ?? preferences.optimizationMode,
    maxStores: options.mode === 'one_store' ? 1 : (options.maxStores ?? preferences.maxStores),
    maxDistanceKm: preferences.maxDistanceKm,
    excludedChainIds: preferences.excludedChainIds,
    preferredChainIds: preferences.preferredChainIds,
    allowSubstitutions: preferences.allowSubstitutions,
    minSubstitutionScore: preferences.minSubstitutionScore,
    memberships: new Set(memberships),
    wantsDelivery: options.wantsDelivery ?? preferences.wantsDelivery,
    budgetAgorot: options.budgetAgorot ?? preferences.weeklyBudgetAgorot,
    now: options.now ?? nowIso(),
  };
}

/** Persists a plan as a basket snapshot so future runs can compare against it. */
export function saveSnapshot(
  db: DatabaseSync,
  basketId: string,
  plan: ShoppingPlan,
  planKind: string,
  capturedAt: string,
): string {
  const snapshotId = newId('snap');
  transaction(db, () => {
    run(
      db,
      `INSERT INTO basket_snapshots (
         id, basket_id, captured_at, total_agorot, covered_line_count, requested_line_count,
         unpriced_line_ids, plan_kind, notes
       ) VALUES (?,?,?,?,?,?,?,?,NULL)`,
      [
        snapshotId,
        basketId,
        capturedAt,
        plan.payableTotalAgorot,
        plan.coveredLineCount,
        plan.requestedLineCount,
        JSON.stringify(plan.unpricedLineIds),
        planKind,
      ],
    );
    for (const leg of plan.legs) {
      for (const line of leg.lines) {
        run(
          db,
          `INSERT INTO basket_snapshot_lines (
             id, snapshot_id, basket_item_id, product_id, display_name, quantity, unit_price_agorot,
             effective_total_agorot, promotion_id, chain_id, branch_id, observed_at, source
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            newId('snl'),
            snapshotId,
            line.lineId,
            line.offeredProductId,
            line.displayName,
            line.quantity,
            line.unitPriceAgorot,
            line.pricing.effectiveTotalAgorot,
            line.pricing.appliedPromotionId,
            line.chainId,
            line.branchId,
            line.observedAt,
            line.source,
          ],
        );
      }
    }
  });
  return snapshotId;
}

export function latestSnapshotId(db: DatabaseSync, basketId: string, before?: string): string | null {
  const row = before
    ? get<Row>(
        db,
        'SELECT id FROM basket_snapshots WHERE basket_id = ? AND captured_at < ? ORDER BY captured_at DESC LIMIT 1',
        [basketId, before],
      )
    : get<Row>(db, 'SELECT id FROM basket_snapshots WHERE basket_id = ? ORDER BY captured_at DESC LIMIT 1', [
        basketId,
      ]);
  return row ? str(row.id) : null;
}

export function optimizeBasket(
  db: DatabaseSync,
  userId: string,
  basket: Basket,
  options: OptimizeOptions = {},
): OptimizationSummary {
  const preferences = getPreferences(db, userId);
  const memberships = listMemberships(db, userId);
  const now = options.now ?? nowIso();
  const constraints = buildConstraints(preferences, memberships, { ...options, now });
  const bundle = buildOffers(db, basket, preferences, { now });
  const outcome = optimize(bundle.lines, bundle.offers, bundle.branches, constraints, preferences.convenienceModel);

  const previousSnapshotId = latestSnapshotId(db, basket.id, now);
  let snapshotId: string | null = null;
  const savings: SavingsResult[] = [];

  if (outcome.recommended) {
    if (options.persist !== false) {
      snapshotId = saveSnapshot(db, basket.id, outcome.recommended, constraints.mode, now);
    }

    // Baseline 1: the cheapest single store, which is what a shopper would
    // otherwise do without the optimizer.
    const singleStore = outcome.oneStore;
    if (singleStore && outcome.recommended.coveredLineCount === singleStore.coveredLineCount) {
      savings.push(
        computeSavings({
          nature: 'potential',
          baseline: 'cheapest_single_store',
          baselineLabel: singleStore.legs[0]?.branch.chainName ?? 'single store',
          baselineTotalAgorot: singleStore.payableTotalAgorot,
          comparedTotalAgorot: outcome.recommended.payableTotalAgorot,
          coveredLineCount: outcome.recommended.coveredLineCount,
          comparableCoverage: true,
          measuredAt: now,
        }),
      );
    }

    // Baseline 2: the most expensive full-coverage single store, i.e. what the
    // same basket would cost at the priciest option available to the user.
    const worst = [...outcome.singleStorePlans]
      .filter((p) => p.coveredLineCount === outcome.recommended?.coveredLineCount)
      .sort((a, b) => b.payableTotalAgorot - a.payableTotalAgorot)[0];
    if (worst && worst.payableTotalAgorot > outcome.recommended.payableTotalAgorot) {
      savings.push(
        computeSavings({
          nature: 'potential',
          baseline: 'selected_store',
          baselineLabel: worst.legs[0]?.branch.chainName ?? 'most expensive store',
          baselineTotalAgorot: worst.payableTotalAgorot,
          comparedTotalAgorot: outcome.recommended.payableTotalAgorot,
          coveredLineCount: outcome.recommended.coveredLineCount,
          comparableCoverage: true,
          measuredAt: now,
        }),
      );
    }
  }

  return {
    outcome,
    bundle,
    constraints,
    convenience: preferences.convenienceModel,
    savings,
    snapshotId,
    previousSnapshotId,
    dataFreshness: {
      oldestObservationAt: bundle.oldestObservationAt,
      newestObservationAt: bundle.newestObservationAt,
      maxPriceAgeDays: MAX_PRICE_AGE_DAYS,
    },
  };
}

export function recordSavingsEvent(
  db: DatabaseSync,
  userId: string,
  basketId: string | null,
  savings: SavingsResult,
): void {
  run(
    db,
    `INSERT INTO savings_events (
       id, user_id, basket_id, nature, baseline_kind, baseline_label, baseline_total_agorot,
       compared_total_agorot, saving_agorot, comparable_coverage, occurred_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId('sav'),
      userId,
      basketId,
      savings.nature,
      savings.baseline,
      savings.baselineLabel,
      savings.baselineTotalAgorot,
      savings.comparedTotalAgorot,
      savings.savingAgorot,
      savings.comparableCoverage ? 1 : 0,
      savings.measuredAt,
    ],
  );
}

export function loadSnapshot(
  db: DatabaseSync,
  snapshotId: string,
): { id: string; capturedAt: string; totalAgorot: number; unpricedLineIds: string[]; lines: Array<{
  productId: string;
  basketItemId: string;
  displayName: string;
  quantity: number;
  unitPriceAgorot: number;
  effectiveTotalAgorot: number;
  promotionId: string | null;
  chainId: string | null;
  observedAt: string;
}> } | null {
  const row = get<Row>(db, 'SELECT * FROM basket_snapshots WHERE id = ?', [snapshotId]);
  if (!row) return null;
  const lines = all<Row>(db, 'SELECT * FROM basket_snapshot_lines WHERE snapshot_id = ?', [snapshotId]).map(
    (line) => ({
      productId: str(line.product_id),
      basketItemId: str(line.basket_item_id),
      displayName: str(line.display_name),
      quantity: num(line.quantity, 1),
      unitPriceAgorot: num(line.unit_price_agorot),
      effectiveTotalAgorot: num(line.effective_total_agorot),
      promotionId: optStr(line.promotion_id),
      chainId: optStr(line.chain_id),
      observedAt: str(line.observed_at),
    }),
  );
  return {
    id: str(row.id),
    capturedAt: str(row.captured_at),
    totalAgorot: num(row.total_agorot),
    unpricedLineIds: JSON.parse(str(row.unpriced_line_ids, '[]')) as string[],
    lines,
  };
}

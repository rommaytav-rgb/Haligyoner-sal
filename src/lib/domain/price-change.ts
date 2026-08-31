/**
 * PriceChangeService — deterministic price-change arithmetic.
 *
 * This module is intentionally free of any AI, I/O or framework dependency.
 * Every percentage the product ever shows is produced here, by the formula
 *
 *     ((current - previous) / previous) * 100
 *
 * and nowhere else. The AI layer is never permitted to compute or restate a
 * number that did not come out of this file.
 */

import { assertAgorot, roundHalfAwayFromZero, type Agorot } from './money';

export type PriceDirection = 'increase' | 'decrease' | 'unchanged';

/** Configurable severity bands, expressed as absolute percentage change. */
export interface SeverityThresholds {
  minimal: number; // 0 <= |%| < minimal  -> 'minimal'
  small: number;
  moderate: number;
  large: number; // |%| >= large -> 'major'
}

export type PriceSeverity = 'minimal' | 'small' | 'moderate' | 'large' | 'major';

export const DEFAULT_SEVERITY_THRESHOLDS: SeverityThresholds = {
  minimal: 2,
  small: 5,
  moderate: 10,
  large: 20,
};

/** A single verified price observation. Never synthesised. */
export interface PriceObservation {
  priceAgorot: Agorot;
  observedAt: string; // ISO 8601
  chainId: string;
  branchId: string | null;
  /** Identity of the exact package this price refers to. */
  productId: string;
  /** Normalised package size in base units, used to detect package changes. */
  packageSizeBaseUnits: number | null;
  promotionId: string | null;
  isMemberPrice: boolean;
  source: string;
  /** 0..1 — how much the pipeline trusts this observation. */
  confidence: number;
}

export type PriceChangeUnavailableReason =
  | 'no_previous_observation'
  | 'previous_price_is_zero'
  | 'invalid_timestamp'
  | 'product_identity_changed'
  | 'package_size_changed';

export interface PriceChangeResult {
  comparable: true;
  previousPriceAgorot: Agorot;
  currentPriceAgorot: Agorot;
  absoluteChangeAgorot: Agorot;
  /** Percentage change, rounded to one decimal place. */
  percentageChange: number;
  direction: PriceDirection;
  severity: PriceSeverity;
  previousObservedAt: string;
  currentObservedAt: string;
  /** Whole days between the two observations. Used to phrase the change honestly. */
  ageDays: number;
  /**
   * True when the previous observation is recent enough that the change can be
   * described as having happened "now". Otherwise the UI must fall back to
   * "current verified price is X; previous recorded price was Y on <date>".
   */
  isRecentComparison: boolean;
  /** Set when exactly one side of the comparison is a promotional price. */
  promotionTransition: 'promotion_started' | 'promotion_ended' | null;
  membershipTransition: 'member_price_started' | 'member_price_ended' | null;
  confidence: number;
}

export interface PriceChangeUnavailable {
  comparable: false;
  reason: PriceChangeUnavailableReason;
  currentPriceAgorot: Agorot | null;
  currentObservedAt: string | null;
  previousPriceAgorot: Agorot | null;
  previousObservedAt: string | null;
}

export type PriceChange = PriceChangeResult | PriceChangeUnavailable;

export interface PriceChangeOptions {
  thresholds?: SeverityThresholds;
  /** A comparison older than this is not described as "changed today". */
  recentComparisonMaxDays?: number;
}

export const DEFAULT_RECENT_COMPARISON_MAX_DAYS = 7;

/** Rounds to `decimals` places, half away from zero, avoiding 1.005 -> 1.00 float traps. */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return roundHalfAwayFromZero(value * factor) / factor;
}

/**
 * The one and only percentage-change formula in the product.
 * Returns null when the baseline is zero (percentage change is undefined).
 */
export function percentageChange(previous: Agorot, current: Agorot): number | null {
  assertAgorot(previous, 'previous price');
  assertAgorot(current, 'current price');
  if (previous === 0) return null;
  return roundTo(((current - previous) / previous) * 100, 1);
}

export function classifySeverity(
  percentage: number,
  thresholds: SeverityThresholds = DEFAULT_SEVERITY_THRESHOLDS,
): PriceSeverity {
  const abs = Math.abs(percentage);
  if (abs < thresholds.minimal) return 'minimal';
  if (abs < thresholds.small) return 'small';
  if (abs < thresholds.moderate) return 'moderate';
  if (abs < thresholds.large) return 'large';
  return 'major';
}

export function directionOf(previous: Agorot, current: Agorot): PriceDirection {
  if (current > previous) return 'increase';
  if (current < previous) return 'decrease';
  return 'unchanged';
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Compares two observations of *the same package of the same product*.
 *
 * Refuses to produce a change when the two observations are not actually
 * comparable — a different product, a different package size, a zero baseline,
 * or an unparseable timestamp. Silence is correct here; an invented comparison
 * is not.
 */
export function comparePrices(
  previous: PriceObservation | null | undefined,
  current: PriceObservation,
  options: PriceChangeOptions = {},
): PriceChange {
  const thresholds = options.thresholds ?? DEFAULT_SEVERITY_THRESHOLDS;
  const maxDays = options.recentComparisonMaxDays ?? DEFAULT_RECENT_COMPARISON_MAX_DAYS;
  const currentAt = parseTimestamp(current.observedAt);

  if (!previous) {
    return {
      comparable: false,
      reason: 'no_previous_observation',
      currentPriceAgorot: current.priceAgorot,
      currentObservedAt: current.observedAt,
      previousPriceAgorot: null,
      previousObservedAt: null,
    };
  }

  const base = {
    currentPriceAgorot: current.priceAgorot,
    currentObservedAt: current.observedAt,
    previousPriceAgorot: previous.priceAgorot,
    previousObservedAt: previous.observedAt,
  };

  if (previous.productId !== current.productId) {
    return { comparable: false, reason: 'product_identity_changed', ...base };
  }
  if (
    previous.packageSizeBaseUnits !== null &&
    current.packageSizeBaseUnits !== null &&
    previous.packageSizeBaseUnits !== current.packageSizeBaseUnits
  ) {
    return { comparable: false, reason: 'package_size_changed', ...base };
  }
  if (previous.priceAgorot === 0) {
    return { comparable: false, reason: 'previous_price_is_zero', ...base };
  }

  const previousAt = parseTimestamp(previous.observedAt);
  if (previousAt === null || currentAt === null) {
    return { comparable: false, reason: 'invalid_timestamp', ...base };
  }

  const pct = percentageChange(previous.priceAgorot, current.priceAgorot);
  // previous.priceAgorot !== 0 was checked above, so pct cannot be null here.
  const percentage = pct ?? 0;
  const ageDays = Math.max(0, Math.floor((currentAt - previousAt) / 86_400_000));

  let promotionTransition: PriceChangeResult['promotionTransition'] = null;
  if (!previous.promotionId && current.promotionId) promotionTransition = 'promotion_started';
  else if (previous.promotionId && !current.promotionId) promotionTransition = 'promotion_ended';

  let membershipTransition: PriceChangeResult['membershipTransition'] = null;
  if (!previous.isMemberPrice && current.isMemberPrice) membershipTransition = 'member_price_started';
  else if (previous.isMemberPrice && !current.isMemberPrice) membershipTransition = 'member_price_ended';

  return {
    comparable: true,
    previousPriceAgorot: previous.priceAgorot,
    currentPriceAgorot: current.priceAgorot,
    absoluteChangeAgorot: current.priceAgorot - previous.priceAgorot,
    percentageChange: percentage,
    direction: directionOf(previous.priceAgorot, current.priceAgorot),
    severity: classifySeverity(percentage, thresholds),
    previousObservedAt: previous.observedAt,
    currentObservedAt: current.observedAt,
    ageDays,
    isRecentComparison: ageDays <= maxDays,
    promotionTransition,
    membershipTransition,
    confidence: Math.min(previous.confidence, current.confidence),
  };
}

/**
 * Personal price baseline and the "should I buy now?" judgement.
 *
 * Everything here is computed from *stored observations only*. When there is not
 * enough history, the answer is "not enough data" — never an extrapolation and
 * never a prediction about future prices.
 */

import { type Agorot } from './money';
import { percentageChange, roundTo } from './price-change';

export interface HistoricalPoint {
  priceAgorot: Agorot;
  observedAt: string;
  /** True when this observation was a promotional price. */
  isPromotional: boolean;
  isMemberPrice: boolean;
  chainId: string;
  source: string;
}

/** Minimum observations before we are willing to talk about a "usual price". */
export const MIN_OBSERVATIONS_FOR_BASELINE = 3;
/** Minimum span of history before a 90-day average is presented as such. */
export const MIN_HISTORY_DAYS_FOR_LONG_WINDOW = 21;

export interface PersonalBaseline {
  hasEnoughData: boolean;
  observationCount: number;
  historySpanDays: number;
  /** Median of regular (non-promotional) prices — the user's "usual" price. */
  usualPriceAgorot: Agorot | null;
  /** Interquartile-ish range around the usual price, for "usually ₪24–₪26". */
  usualRangeAgorot: { low: Agorot; high: Agorot } | null;
  averagePriceAgorot: Agorot | null;
  lowestObservedAgorot: Agorot | null;
  lowestObservedAt: string | null;
  highestObservedAgorot: Agorot | null;
  highestObservedAt: string | null;
  latestPriceAgorot: Agorot | null;
  latestObservedAt: string | null;
}

function sortByTime(points: readonly HistoricalPoint[]): HistoricalPoint[] {
  return [...points].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return Math.round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index] as number;
}

export function computeBaseline(points: readonly HistoricalPoint[]): PersonalBaseline {
  const ordered = sortByTime(points);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const spanDays =
    first && last ? Math.max(0, Math.floor((Date.parse(last.observedAt) - Date.parse(first.observedAt)) / 86_400_000)) : 0;

  if (ordered.length === 0) {
    return {
      hasEnoughData: false,
      observationCount: 0,
      historySpanDays: 0,
      usualPriceAgorot: null,
      usualRangeAgorot: null,
      averagePriceAgorot: null,
      lowestObservedAgorot: null,
      lowestObservedAt: null,
      highestObservedAgorot: null,
      highestObservedAt: null,
      latestPriceAgorot: null,
      latestObservedAt: null,
    };
  }

  // "Usual" deliberately excludes promotional prices: a run of sale prices must
  // not drag the user's baseline down and make the regular price look like a hike.
  const regular = ordered.filter((p) => !p.isPromotional);
  const basis = regular.length >= MIN_OBSERVATIONS_FOR_BASELINE ? regular : ordered;
  const prices = basis.map((p) => p.priceAgorot);

  let lowest = ordered[0] as HistoricalPoint;
  let highest = ordered[0] as HistoricalPoint;
  for (const p of ordered) {
    if (p.priceAgorot < lowest.priceAgorot) lowest = p;
    if (p.priceAgorot > highest.priceAgorot) highest = p;
  }

  const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const low = percentile(prices, 25);
  const high = percentile(prices, 75);

  return {
    hasEnoughData: ordered.length >= MIN_OBSERVATIONS_FOR_BASELINE,
    observationCount: ordered.length,
    historySpanDays: spanDays,
    usualPriceAgorot: median(prices),
    usualRangeAgorot: low !== null && high !== null ? { low, high } : null,
    averagePriceAgorot: average,
    lowestObservedAgorot: lowest.priceAgorot,
    lowestObservedAt: lowest.observedAt,
    highestObservedAgorot: highest.priceAgorot,
    highestObservedAt: highest.observedAt,
    latestPriceAgorot: (last as HistoricalPoint).priceAgorot,
    latestObservedAt: (last as HistoricalPoint).observedAt,
  };
}

/** Average over a trailing window. Returns null when the window is not covered. */
export function windowAverage(
  points: readonly HistoricalPoint[],
  days: number,
  now: string,
): { averageAgorot: Agorot; sampleCount: number; coversFullWindow: boolean } | null {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) return null;
  const cutoff = nowMs - days * 86_400_000;
  const inWindow = points.filter((p) => {
    const t = Date.parse(p.observedAt);
    return !Number.isNaN(t) && t >= cutoff && t <= nowMs;
  });
  if (inWindow.length === 0) return null;
  const oldest = Math.min(...inWindow.map((p) => Date.parse(p.observedAt)));
  const total = inWindow.reduce((acc, p) => acc + p.priceAgorot, 0);
  return {
    averageAgorot: Math.round(total / inWindow.length),
    sampleCount: inWindow.length,
    // "Covers the full window" means we have data from at least 80% of the way back.
    coversFullWindow: nowMs - oldest >= days * 86_400_000 * 0.8,
  };
}

/** Price at, or just before, a point in the past. Never interpolated. */
export function priceAsOf(points: readonly HistoricalPoint[], daysAgo: number, now: string): HistoricalPoint | null {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) return null;
  const target = nowMs - daysAgo * 86_400_000;
  let best: HistoricalPoint | null = null;
  let bestTime = -Infinity;
  for (const p of points) {
    const t = Date.parse(p.observedAt);
    if (Number.isNaN(t) || t > target) continue;
    if (t > bestTime) {
      bestTime = t;
      best = p;
    }
  }
  return best;
}

export type BuyVerdict = 'good_time_to_buy' | 'about_normal' | 'consider_waiting' | 'not_enough_data';

export interface BuyAdvice {
  verdict: BuyVerdict;
  currentPriceAgorot: Agorot;
  usualPriceAgorot: Agorot | null;
  /** Signed percentage of current vs the user's usual price. */
  percentageVsUsual: number | null;
  isLowestObserved: boolean;
  /** Present only when the current price is genuinely the lowest we ever stored. */
  observationCount: number;
  activePromotion: { id: string; description: string; endsAt: string | null } | null;
  /** Human-facing reasons, as machine-readable keys the UI translates. */
  reasons: string[];
}

export interface BuyAdviceOptions {
  /** |%| below which the price is "about normal". */
  normalBandPercent?: number;
  activePromotion?: { id: string; description: string; endsAt: string | null } | null;
}

/**
 * Judges whether now is a good time to buy, using only observed history.
 * Deliberately makes no claim about where the price is heading next.
 */
export function adviseOnPurchase(
  currentPriceAgorot: Agorot,
  history: readonly HistoricalPoint[],
  options: BuyAdviceOptions = {},
): BuyAdvice {
  const band = options.normalBandPercent ?? 5;
  const baseline = computeBaseline(history);
  const promotion = options.activePromotion ?? null;
  const reasons: string[] = [];

  if (!baseline.hasEnoughData || baseline.usualPriceAgorot === null) {
    if (promotion) reasons.push('active_promotion');
    reasons.push('insufficient_history');
    return {
      verdict: 'not_enough_data',
      currentPriceAgorot,
      usualPriceAgorot: baseline.usualPriceAgorot,
      percentageVsUsual: null,
      isLowestObserved: false,
      observationCount: baseline.observationCount,
      activePromotion: promotion,
      reasons,
    };
  }

  const pct = percentageChange(baseline.usualPriceAgorot, currentPriceAgorot);
  const isLowest =
    baseline.lowestObservedAgorot !== null && currentPriceAgorot <= baseline.lowestObservedAgorot;

  let verdict: BuyVerdict;
  if (pct === null || Math.abs(pct) <= band) {
    verdict = 'about_normal';
    reasons.push('within_normal_band');
  } else if (pct < 0) {
    verdict = 'good_time_to_buy';
    reasons.push('below_usual_price');
  } else {
    verdict = 'consider_waiting';
    reasons.push('above_usual_price');
  }

  if (isLowest) reasons.push('lowest_observed_price');
  if (promotion) reasons.push('active_promotion');

  return {
    verdict,
    currentPriceAgorot,
    usualPriceAgorot: baseline.usualPriceAgorot,
    percentageVsUsual: pct === null ? null : roundTo(pct, 1),
    isLowestObserved: isLowest,
    observationCount: baseline.observationCount,
    activePromotion: promotion,
    reasons,
  };
}

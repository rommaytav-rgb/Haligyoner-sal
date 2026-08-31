/**
 * Savings arithmetic.
 *
 * Rule from the product spec: a savings figure without its baseline is
 * meaningless, so every result here carries the baseline it was measured
 * against and whether it is *potential* (an offer the user has not acted on) or
 * *confirmed* (a purchase the user told us actually happened).
 */

import { type Agorot } from './money';
import { percentageChange } from './price-change';

export type SavingsBaselineKind =
  | 'previous_basket' // what this basket cost last time we priced it
  | 'usual_basket' // the user's own habitual store/basket
  | 'cheapest_single_store'
  | 'selected_store'
  | 'verified_purchase'; // an imported receipt

export type SavingsNature = 'potential' | 'confirmed';

export interface SavingsResult {
  nature: SavingsNature;
  baseline: SavingsBaselineKind;
  baselineLabel: string;
  baselineTotalAgorot: Agorot;
  comparedTotalAgorot: Agorot;
  /** Positive means the compared option is cheaper than the baseline. */
  savingAgorot: Agorot;
  savingPercentage: number | null;
  /** Number of basket lines both totals cover. Unequal coverage is not a saving. */
  coveredLineCount: number;
  comparableCoverage: boolean;
  measuredAt: string;
}

export function computeSavings(params: {
  nature: SavingsNature;
  baseline: SavingsBaselineKind;
  baselineLabel: string;
  baselineTotalAgorot: Agorot;
  comparedTotalAgorot: Agorot;
  coveredLineCount: number;
  comparableCoverage: boolean;
  measuredAt: string;
}): SavingsResult {
  const saving = params.baselineTotalAgorot - params.comparedTotalAgorot;
  const pct = percentageChange(params.baselineTotalAgorot, params.comparedTotalAgorot);
  return {
    nature: params.nature,
    baseline: params.baseline,
    baselineLabel: params.baselineLabel,
    baselineTotalAgorot: params.baselineTotalAgorot,
    comparedTotalAgorot: params.comparedTotalAgorot,
    savingAgorot: saving,
    savingPercentage: pct === null ? null : -pct,
    coveredLineCount: params.coveredLineCount,
    comparableCoverage: params.comparableCoverage,
    measuredAt: params.measuredAt,
  };
}

export interface SavingsRollup {
  potentialAgorot: Agorot;
  confirmedAgorot: Agorot;
  eventCount: number;
  periodStart: string;
  periodEnd: string;
}

export interface SavingsEventRecord {
  nature: SavingsNature;
  savingAgorot: Agorot;
  occurredAt: string;
}

/**
 * Rolls up savings over a period, keeping potential and confirmed strictly
 * separate. Negative savings (the basket got more expensive) are included as-is
 * rather than clipped, so the totals cannot be inflated.
 */
export function rollupSavings(
  events: readonly SavingsEventRecord[],
  periodStart: string,
  periodEnd: string,
): SavingsRollup {
  const startMs = Date.parse(periodStart);
  const endMs = Date.parse(periodEnd);
  let potential = 0;
  let confirmed = 0;
  let count = 0;

  for (const event of events) {
    const t = Date.parse(event.occurredAt);
    if (Number.isNaN(t) || t < startMs || t > endMs) continue;
    count += 1;
    if (event.nature === 'confirmed') confirmed += event.savingAgorot;
    else potential += event.savingAgorot;
  }

  return { potentialAgorot: potential, confirmedAgorot: confirmed, eventCount: count, periodStart, periodEnd };
}

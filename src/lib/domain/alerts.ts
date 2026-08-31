/**
 * Price alert engine.
 *
 * Evaluates user-defined alert rules against verified observations. Rules are
 * evaluated deterministically; the AI layer only ever phrases the result.
 */

import { type Agorot } from './money';
import { percentageChange } from './price-change';

export type AlertKind =
  | 'price_below'
  | 'price_increase_percent'
  | 'price_decrease_percent'
  | 'promotion_appears'
  | 'promotion_ends'
  | 'historical_low'
  | 'basket_increase_above'
  | 'basket_decrease_below';

export interface AlertRule {
  id: string;
  userId: string;
  kind: AlertKind;
  /** Product-scoped rules target a product; basket rules target a basket. */
  productId: string | null;
  basketId: string | null;
  /** Threshold in agorot for money rules, or percent for percentage rules. */
  thresholdValue: number;
  enabled: boolean;
  label: string;
  createdAt: string;
}

export interface ProductAlertInput {
  productId: string;
  displayName: string;
  currentPriceAgorot: Agorot;
  previousPriceAgorot: Agorot | null;
  currentPromotionId: string | null;
  previousPromotionId: string | null;
  historicalLowAgorot: Agorot | null;
  observationCount: number;
  observedAt: string;
  chainId: string;
}

export interface BasketAlertInput {
  basketId: string;
  currentTotalAgorot: Agorot;
  previousTotalAgorot: Agorot | null;
  comparableCoverage: boolean;
  capturedAt: string;
}

export interface TriggeredAlert {
  ruleId: string;
  kind: AlertKind;
  productId: string | null;
  basketId: string | null;
  /** Machine-readable payload; the UI/AI renders it into a sentence. */
  facts: {
    displayName?: string;
    currentPriceAgorot?: Agorot;
    previousPriceAgorot?: Agorot;
    percentageChange?: number;
    thresholdValue: number;
    chainId?: string;
  };
  triggeredAt: string;
}

export function evaluateProductAlerts(
  rules: readonly AlertRule[],
  input: ProductAlertInput,
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];
  const pct =
    input.previousPriceAgorot !== null
      ? percentageChange(input.previousPriceAgorot, input.currentPriceAgorot)
      : null;

  for (const rule of rules) {
    if (!rule.enabled || rule.productId !== input.productId) continue;
    const base = {
      ruleId: rule.id,
      kind: rule.kind,
      productId: input.productId,
      basketId: null,
      triggeredAt: input.observedAt,
    };
    const facts = {
      displayName: input.displayName,
      currentPriceAgorot: input.currentPriceAgorot,
      thresholdValue: rule.thresholdValue,
      chainId: input.chainId,
      ...(input.previousPriceAgorot !== null ? { previousPriceAgorot: input.previousPriceAgorot } : {}),
      ...(pct !== null ? { percentageChange: pct } : {}),
    };

    switch (rule.kind) {
      case 'price_below':
        if (input.currentPriceAgorot < rule.thresholdValue) triggered.push({ ...base, facts });
        break;
      case 'price_increase_percent':
        if (pct !== null && pct >= rule.thresholdValue) triggered.push({ ...base, facts });
        break;
      case 'price_decrease_percent':
        if (pct !== null && -pct >= rule.thresholdValue) triggered.push({ ...base, facts });
        break;
      case 'promotion_appears':
        if (!input.previousPromotionId && input.currentPromotionId) triggered.push({ ...base, facts });
        break;
      case 'promotion_ends':
        if (input.previousPromotionId && !input.currentPromotionId) triggered.push({ ...base, facts });
        break;
      case 'historical_low':
        // Only claim a historical low when there is real history behind the claim.
        if (
          input.historicalLowAgorot !== null &&
          input.observationCount >= 3 &&
          input.currentPriceAgorot <= input.historicalLowAgorot
        ) {
          triggered.push({ ...base, facts });
        }
        break;
      default:
        break;
    }
  }
  return triggered;
}

export function evaluateBasketAlerts(
  rules: readonly AlertRule[],
  input: BasketAlertInput,
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];
  if (input.previousTotalAgorot === null) return triggered;
  // A change driven by different coverage is not a price change; do not alert on it.
  if (!input.comparableCoverage) return triggered;

  const delta = input.currentTotalAgorot - input.previousTotalAgorot;
  const pct = percentageChange(input.previousTotalAgorot, input.currentTotalAgorot);

  for (const rule of rules) {
    if (!rule.enabled || rule.basketId !== input.basketId) continue;
    const entry: TriggeredAlert = {
      ruleId: rule.id,
      kind: rule.kind,
      productId: null,
      basketId: input.basketId,
      facts: {
        currentPriceAgorot: input.currentTotalAgorot,
        previousPriceAgorot: input.previousTotalAgorot,
        thresholdValue: rule.thresholdValue,
        ...(pct !== null ? { percentageChange: pct } : {}),
      },
      triggeredAt: input.capturedAt,
    };
    if (rule.kind === 'basket_increase_above' && delta >= rule.thresholdValue) triggered.push(entry);
    if (rule.kind === 'basket_decrease_below' && -delta >= rule.thresholdValue) triggered.push(entry);
  }
  return triggered;
}

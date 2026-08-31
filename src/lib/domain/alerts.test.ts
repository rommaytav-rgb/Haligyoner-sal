import { describe, expect, it } from 'vitest';
import {
  evaluateBasketAlerts,
  evaluateProductAlerts,
  type AlertRule,
  type BasketAlertInput,
  type ProductAlertInput,
} from './alerts';

function rule(over: Partial<AlertRule> & { id: string; kind: AlertRule['kind']; thresholdValue: number }): AlertRule {
  return {
    userId: 'u1',
    productId: 'coffee',
    basketId: null,
    enabled: true,
    label: over.id,
    createdAt: '2026-08-01T00:00:00Z',
    ...over,
  };
}

const product: ProductAlertInput = {
  productId: 'coffee',
  displayName: 'Coffee 200g',
  currentPriceAgorot: 3100,
  previousPriceAgorot: 2400,
  currentPromotionId: null,
  previousPromotionId: null,
  historicalLowAgorot: 2100,
  observationCount: 8,
  observedAt: '2026-08-31T08:00:00Z',
  chainId: 'rami-levy',
};

describe('evaluateProductAlerts', () => {
  it('fires on a percentage increase above the threshold', () => {
    const fired = evaluateProductAlerts([rule({ id: 'r1', kind: 'price_increase_percent', thresholdValue: 10 })], product);
    expect(fired).toHaveLength(1);
    expect(fired[0]?.facts.percentageChange).toBe(29.2);
  });

  it('does not fire below the threshold', () => {
    const small = { ...product, currentPriceAgorot: 2500 };
    expect(evaluateProductAlerts([rule({ id: 'r1', kind: 'price_increase_percent', thresholdValue: 10 })], small)).toHaveLength(0);
  });

  it('fires when a price drops below an absolute target', () => {
    const cheap = { ...product, currentPriceAgorot: 750 };
    const fired = evaluateProductAlerts([rule({ id: 'r2', kind: 'price_below', thresholdValue: 800 })], cheap);
    expect(fired).toHaveLength(1);
  });

  it('fires on a percentage decrease', () => {
    const cheaper = { ...product, currentPriceAgorot: 2000 };
    const fired = evaluateProductAlerts([rule({ id: 'r3', kind: 'price_decrease_percent', thresholdValue: 15 })], cheaper);
    expect(fired).toHaveLength(1);
  });

  it('fires when a promotion appears and when it ends', () => {
    const started = { ...product, currentPromotionId: 'promo-1' };
    expect(evaluateProductAlerts([rule({ id: 'r4', kind: 'promotion_appears', thresholdValue: 0 })], started)).toHaveLength(1);
    const ended = { ...product, previousPromotionId: 'promo-1' };
    expect(evaluateProductAlerts([rule({ id: 'r5', kind: 'promotion_ends', thresholdValue: 0 })], ended)).toHaveLength(1);
  });

  it('claims a historical low only with enough observations behind it', () => {
    const atLow = { ...product, currentPriceAgorot: 2100 };
    expect(evaluateProductAlerts([rule({ id: 'r6', kind: 'historical_low', thresholdValue: 0 })], atLow)).toHaveLength(1);
    const thin = { ...atLow, observationCount: 2 };
    expect(evaluateProductAlerts([rule({ id: 'r6', kind: 'historical_low', thresholdValue: 0 })], thin)).toHaveLength(0);
  });

  it('ignores disabled rules and rules for other products', () => {
    expect(evaluateProductAlerts([rule({ id: 'r7', kind: 'price_increase_percent', thresholdValue: 1, enabled: false })], product)).toHaveLength(0);
    expect(evaluateProductAlerts([rule({ id: 'r8', kind: 'price_increase_percent', thresholdValue: 1, productId: 'milk' })], product)).toHaveLength(0);
  });

  it('cannot fire a percentage rule without a previous price', () => {
    const noHistory = { ...product, previousPriceAgorot: null };
    expect(evaluateProductAlerts([rule({ id: 'r9', kind: 'price_increase_percent', thresholdValue: 1 })], noHistory)).toHaveLength(0);
  });
});

describe('evaluateBasketAlerts', () => {
  const basket: BasketAlertInput = {
    basketId: 'b1',
    currentTotalAgorot: 64000,
    previousTotalAgorot: 61200,
    comparableCoverage: true,
    capturedAt: '2026-08-31T08:00:00Z',
  };
  const basketRule = (kind: AlertRule['kind'], thresholdValue: number) =>
    rule({ id: kind, kind, thresholdValue, productId: null, basketId: 'b1' });

  it('fires when the basket rises above the threshold', () => {
    expect(evaluateBasketAlerts([basketRule('basket_increase_above', 2500)], basket)).toHaveLength(1);
    expect(evaluateBasketAlerts([basketRule('basket_increase_above', 3000)], basket)).toHaveLength(0);
  });

  it('fires when the basket falls by more than the threshold', () => {
    const cheaper = { ...basket, currentTotalAgorot: 57000 };
    expect(evaluateBasketAlerts([basketRule('basket_decrease_below', 4000)], cheaper)).toHaveLength(1);
  });

  it('refuses to alert when the two baskets covered different products', () => {
    const gappy = { ...basket, comparableCoverage: false };
    expect(evaluateBasketAlerts([basketRule('basket_increase_above', 100)], gappy)).toHaveLength(0);
  });
});

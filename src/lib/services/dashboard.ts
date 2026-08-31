/**
 * Read model for the dashboard.
 *
 * Assembles everything the home screen shows in one place, so the page component
 * stays presentational and the business logic stays testable.
 */

import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '@/lib/db/client';
import type { BasketChangeSummary } from '@/lib/domain/basket-change';
import type { OptimizationOutcome } from '@/lib/domain/optimizer';
import type { SavingsResult } from '@/lib/domain/savings';
import { getBasket, getDefaultBasket, type Basket } from './baskets';
import { optimizeBasket } from './pricing';
import { latestComparison, savingsSummary, type SavingsSummary } from './report';
import { basketWatch, groupMovements, type MovementGroup } from './price-intelligence';
import { getPreferences } from './users';

export interface DashboardData {
  basket: Basket | null;
  outcome: OptimizationOutcome | null;
  savings: SavingsResult[];
  comparison: BasketChangeSummary | null;
  movements: MovementGroup | null;
  savingsRollup: SavingsSummary;
  coverage: {
    requestedLineCount: number;
    coveredLineCount: number;
    unmatchedItemCount: number;
    unpricedItemCount: number;
  } | null;
  dataFreshness: { oldestObservationAt: string | null; newestObservationAt: string | null } | null;
}

export function loadDashboard(
  db: DatabaseSync,
  userId: string,
  options: { basketId?: string; now?: string } = {},
): DashboardData {
  const now = options.now ?? nowIso();
  const basket = options.basketId ? getBasket(db, userId, options.basketId) : getDefaultBasket(db, userId);
  const savingsRollup = savingsSummary(db, userId, now);

  if (!basket) {
    return {
      basket: null,
      outcome: null,
      savings: [],
      comparison: null,
      movements: null,
      savingsRollup,
      coverage: null,
      dataFreshness: null,
    };
  }

  // The dashboard previews the optimization without writing a snapshot; saving a
  // snapshot is an explicit action, so basket history reflects real check-ins
  // rather than every page view.
  const summary = optimizeBasket(db, userId, basket, { persist: false, now });
  const preferences = getPreferences(db, userId);
  const comparison = latestComparison(db, basket.id, preferences.severityThresholds);

  const productIds = basket.items
    .map((item) => item.productId)
    .filter((id): id is string => id !== null);
  const movements = productIds.length > 0 ? groupMovements(basketWatch(db, productIds, { sinceDays: 7, now })) : null;

  return {
    basket,
    outcome: summary.outcome,
    savings: summary.savings,
    comparison: comparison?.summary ?? null,
    movements,
    savingsRollup,
    coverage: {
      requestedLineCount: basket.items.length,
      coveredLineCount: summary.outcome.recommended?.coveredLineCount ?? 0,
      unmatchedItemCount: summary.bundle.unmatchedItemIds.length,
      unpricedItemCount: summary.bundle.unpricedItemIds.length,
    },
    dataFreshness: {
      oldestObservationAt: summary.bundle.oldestObservationAt,
      newestObservationAt: summary.bundle.newestObservationAt,
    },
  };
}

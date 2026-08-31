/**
 * End-to-end test of the MVP loop described in the product specification:
 * sign up -> create a basket -> enter products in natural language -> match ->
 * price from provider data -> optimize single/multi-store -> save -> compare a
 * later run against the earlier one -> alerts and savings.
 *
 * It runs against an in-memory database seeded from the demo dataset, using the
 * same ingest path a live provider would use.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createMemoryDb, get, type Row } from '@/lib/db/client';
import { createUser, getPreferences, listMemberships, setMembership, updatePreferences } from '@/lib/services/users';
import { addItems, createBasket, getBasket, rematchUnmatchedItems } from '@/lib/services/baskets';
import { ingestSnapshot, syncChainRegistry } from '@/lib/services/catalog';
import { DemoPriceProvider } from '@/lib/providers/demo-provider';
import { optimizeBasket, recordSavingsEvent } from '@/lib/services/pricing';
import { compareSnapshots, savingsSummary } from '@/lib/services/report';
import { basketWatch, groupMovements, productIntelligence } from '@/lib/services/price-intelligence';
import { createAlert, evaluateAlerts, recordNotifications } from '@/lib/services/alerts';
import { parseBasketTextWithRules } from '@/lib/ai/rule-parser';
import { factsFromSummary, templateExplanation } from '@/lib/ai/explain';
import { contributionsReconcile } from '@/lib/domain/basket-change';
import { createSession, resolveSession } from '@/lib/auth/session';

const SHOPPING_LIST = `4 חלב 3% 1 ליטר
ביצים L 12 יחידות
2 לחם אחיד פרוס 750 גרם
קפה טורקי עלית 200 גרם — לא להחליף
אורז סוגת 1 ק"ג
2 חזה עוף טרי 1 ק"ג
קורנפלקס תלמה 500 גרם
גבינה צהובה עמק 400 גרם`;

let db: DatabaseSync;
let userId: string;
let basketId: string;
let weeks: string[];
let earlierSnapshotId: string;
let laterSnapshotId: string;

const provider = new DemoPriceProvider();

beforeAll(async () => {
  db = createMemoryDb();
  syncChainRegistry(db);

  weeks = [...new Set(provider.fullHistory().map((p) => p.observedAt))].sort();
  // Ingest everything except the final week, so the basket can be priced twice
  // and the second run has a genuine earlier observation to compare against.
  for (const observedAt of weeks.slice(0, -1)) {
    ingestSnapshot(db, provider.snapshotAsOf(observedAt));
  }

  const user = await createUser(db, { email: 'loop@example.com', password: 'integration-test-pw' });
  userId = user.id;
  updatePreferences(db, userId, {
    homeLatitude: 32.0753,
    homeLongitude: 34.7818,
    maxStores: 2,
    maxDistanceKm: 20,
    optimizationMode: 'best_value',
  });
  setMembership(db, userId, 'shufersal', true);

  const basket = createBasket(db, userId, 'Weekly');
  basketId = basket.id;
  const parsed = parseBasketTextWithRules(SHOPPING_LIST);
  addItems(db, userId, basketId, parsed.items);
});

describe('sign-up and session', () => {
  it('issues a session that resolves back to the user', () => {
    const { token } = createSession(db, userId);
    expect(resolveSession(db, token)?.id).toBe(userId);
    expect(resolveSession(db, 'not-a-real-token')).toBeNull();
  });

  it('stores preferences and memberships', () => {
    expect(getPreferences(db, userId).maxStores).toBe(2);
    expect(listMemberships(db, userId)).toEqual(['shufersal']);
  });
});

describe('natural language basket entry', () => {
  it('structures the list and matches every line to a catalog product', () => {
    const basket = getBasket(db, userId, basketId);
    expect(basket?.items).toHaveLength(8);
    expect(basket?.items.every((item) => item.productId !== null)).toBe(true);
  });

  it('keeps the user’s own wording alongside the match', () => {
    const basket = getBasket(db, userId, basketId);
    const coffee = basket?.items.find((i) => i.rawText.includes('קפה'));
    expect(coffee?.rawText).toContain('קפה טורקי עלית');
    expect(coffee?.isLocked).toBe(true);
  });

  it('reads quantities from the list', () => {
    const basket = getBasket(db, userId, basketId);
    expect(basket?.items[0]?.quantity).toBe(4);
    expect(basket?.items[5]?.quantity).toBe(2);
  });
});

describe('pricing and optimization', () => {
  it('prices the basket across chains and produces a plan per store count', () => {
    const basket = getBasket(db, userId, basketId);
    const summary = optimizeBasket(db, userId, basket!, { now: weeks[weeks.length - 2] });
    earlierSnapshotId = summary.snapshotId as string;

    expect(summary.bundle.branches.length).toBeGreaterThanOrEqual(6);
    expect(summary.outcome.byStoreCount).toHaveLength(2);
    expect(summary.outcome.recommended?.coveredLineCount).toBe(8);
    expect(summary.outcome.recommended?.unpricedLineIds).toEqual([]);
    expect(earlierSnapshotId).toBeTruthy();
  });

  it('never prices a multi-store plan above the best single store', () => {
    const basket = getBasket(db, userId, basketId);
    const { outcome } = optimizeBasket(db, userId, basket!, { persist: false, now: weeks[weeks.length - 2] });
    const single = outcome.byStoreCount.find((e) => e.storeCount === 1)?.plan;
    const multi = outcome.byStoreCount.find((e) => e.storeCount === 2)?.plan;
    expect(multi!.payableTotalAgorot).toBeLessThanOrEqual(single!.payableTotalAgorot);
  });

  it('honours the never-substitute lock', () => {
    const basket = getBasket(db, userId, basketId);
    const coffee = basket!.items.find((i) => i.isLocked);
    const { outcome } = optimizeBasket(db, userId, basket!, { persist: false, now: weeks[weeks.length - 2] });
    const line = outcome.recommended!.legs.flatMap((leg) => leg.lines).find((l) => l.lineId === coffee!.id);
    expect(line?.isSubstitute).toBe(false);
    expect(line?.offeredProductId).toBe(coffee!.productId);
  });

  it('respects the distance limit', () => {
    const basket = getBasket(db, userId, basketId);
    updatePreferences(db, userId, { maxDistanceKm: 5 });
    const { outcome } = optimizeBasket(db, userId, basket!, { persist: false, now: weeks[weeks.length - 2] });
    for (const leg of outcome.recommended!.legs) {
      expect(leg.branch.distanceKm).not.toBeNull();
      expect(leg.branch.distanceKm as number).toBeLessThanOrEqual(5);
    }
    updatePreferences(db, userId, { maxDistanceKm: 20 });
  });

  it('excludes a chain the user rejected', () => {
    const basket = getBasket(db, userId, basketId);
    updatePreferences(db, userId, { excludedChainIds: ['rami-levy'] });
    const { outcome } = optimizeBasket(db, userId, basket!, { persist: false, now: weeks[weeks.length - 2] });
    const chains = outcome.recommended!.legs.map((leg) => leg.branch.chainId);
    expect(chains).not.toContain('rami-levy');
    updatePreferences(db, userId, { excludedChainIds: [] });
  });

  it('charges a delivery fee when delivery is requested', () => {
    const basket = getBasket(db, userId, basketId);
    const walking = optimizeBasket(db, userId, basket!, { persist: false, now: weeks[weeks.length - 2] });
    const delivered = optimizeBasket(db, userId, basket!, {
      persist: false,
      wantsDelivery: true,
      now: weeks[weeks.length - 2],
    });
    expect(delivered.outcome.recommended!.deliveryTotalAgorot).toBeGreaterThan(0);
    expect(walking.outcome.recommended!.deliveryTotalAgorot).toBe(0);
    expect(delivered.outcome.recommended!.travelCostAgorot).toBe(0);
  });
});

describe('the week after: price changes', () => {
  beforeAll(() => {
    // The final week of the dataset lands, and the basket is priced again.
    ingestSnapshot(db, provider.snapshotAsOf(weeks[weeks.length - 1] as string));
    const basket = getBasket(db, userId, basketId);
    const summary = optimizeBasket(db, userId, basket!, { now: weeks[weeks.length - 1] });
    laterSnapshotId = summary.snapshotId as string;
    for (const saving of summary.savings) recordSavingsEvent(db, userId, basketId, saving);
  });

  it('compares the two snapshots and reconciles the line contributions', () => {
    const comparison = compareSnapshots(db, earlierSnapshotId, laterSnapshotId);
    expect(comparison).not.toBeNull();
    expect(comparison!.reconciles).toBe(true);
    expect(contributionsReconcile(comparison!.summary)).toBe(true);
  });

  it('reports which products moved', () => {
    const { summary } = compareSnapshots(db, earlierSnapshotId, laterSnapshotId)!;
    expect(summary.counts.increased + summary.counts.decreased + summary.counts.unchanged).toBe(8);
    expect(summary.lines.every((line) => line.displayName.length > 0)).toBe(true);
  });

  it('produces a deterministic explanation containing only computed numbers', () => {
    const { summary } = compareSnapshots(db, earlierSnapshotId, laterSnapshotId)!;
    const facts = factsFromSummary(summary);
    const heText = templateExplanation(facts, 'he');
    const enText = templateExplanation(facts, 'en');
    expect(heText.length).toBeGreaterThan(10);
    expect(enText).toMatch(/basket/i);
  });

  it('shows the coffee rise the dataset scripted', () => {
    const basket = getBasket(db, userId, basketId);
    const coffee = basket!.items.find((i) => i.rawText.includes('קפה'));
    const entries = basketWatch(db, [coffee!.productId as string], { sinceDays: 5 });
    const entry = entries[0];
    expect(entry?.change.comparable).toBe(true);
    if (entry?.change.comparable) {
      expect(entry.change.direction).toBe('increase');
      expect(entry.change.percentageChange).toBeGreaterThan(15);
      expect(entry.change.severity).toBe('major');
    }
  });

  it('groups the basket into rising and falling products', () => {
    const basket = getBasket(db, userId, basketId);
    const ids = basket!.items.map((i) => i.productId as string);
    const groups = groupMovements(basketWatch(db, ids, { sinceDays: 5 }));
    expect(groups.rising.length + groups.falling.length + groups.unchanged.length).toBeGreaterThan(0);
  });
});

describe('price intelligence', () => {
  it('builds a baseline and a timeline from stored history only', () => {
    const basket = getBasket(db, userId, basketId);
    const coffee = basket!.items.find((i) => i.rawText.includes('קפה'));
    const intel = productIntelligence(db, coffee!.productId as string, { now: weeks[weeks.length - 1] });
    expect(intel).not.toBeNull();
    expect(intel!.baseline.hasEnoughData).toBe(true);
    expect(intel!.timeline.length).toBeGreaterThan(5);
    expect(intel!.comparisons.ninetyDayAverage?.sampleCount).toBeGreaterThan(5);
    expect(intel!.advice?.verdict).toBeDefined();
  });

  it('never reports a comparison it does not have data for', () => {
    const intel = productIntelligence(db, 'no-such-product');
    expect(intel).toBeNull();
  });
});

describe('alerts and savings', () => {
  it('fires a rule when a product rises past its threshold', () => {
    const basket = getBasket(db, userId, basketId);
    const coffee = basket!.items.find((i) => i.rawText.includes('קפה'));
    createAlert(db, userId, {
      kind: 'price_increase_percent',
      productId: coffee!.productId,
      thresholdValue: 10,
      label: 'coffee up 10%',
    });
    const triggered = evaluateAlerts(db, userId, [basket!], { sinceDays: 5 });
    expect(triggered.length).toBeGreaterThan(0);
    const written = recordNotifications(db, userId, triggered);
    expect(written).toBeGreaterThan(0);
    // Re-running must not duplicate notifications.
    expect(recordNotifications(db, userId, triggered)).toBe(0);
  });

  it('rolls up savings with potential and confirmed kept apart', () => {
    const summary = savingsSummary(db, userId, weeks[weeks.length - 1]);
    expect(summary.week.eventCount).toBeGreaterThan(0);
    expect(summary.week.confirmedAgorot).toBe(0);
    expect(summary.year.eventCount).toBeGreaterThanOrEqual(summary.week.eventCount);
  });
});

describe('user isolation', () => {
  it('does not expose another user’s basket', async () => {
    const other = await createUser(db, { email: 'other@example.com', password: 'another-test-pw' });
    expect(getBasket(db, other.id, basketId)).toBeNull();
    const otherBasket = createBasket(db, other.id, 'Theirs');
    expect(getBasket(db, userId, otherBasket.id)).toBeNull();
  });

  it('cascades deletion of a user’s data', async () => {
    const doomed = await createUser(db, { email: 'doomed@example.com', password: 'delete-me-please' });
    const basket = createBasket(db, doomed.id, 'Temp');
    addItems(db, doomed.id, basket.id, [{ rawText: 'חלב 3% 1 ליטר' }]);
    db.prepare('DELETE FROM users WHERE id = ?').run(doomed.id);
    const remaining = get<Row>(db, 'SELECT COUNT(*) AS n FROM basket_items WHERE basket_id = ?', [basket.id]);
    expect(Number(remaining?.n)).toBe(0);
  });
});

describe('rematching', () => {
  it('is a no-op when everything is already matched', () => {
    expect(rematchUnmatchedItems(db, userId, basketId)).toBe(0);
  });
});

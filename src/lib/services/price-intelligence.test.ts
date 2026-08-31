import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createMemoryDb, run } from '@/lib/db/client';
import { aggregateMovement, basketWatch, buildTimeline, loadHistory, productIntelligence } from './price-intelligence';

const NOW = '2026-08-31T12:00:00.000Z';
const PRODUCT = 'prod_coffee';

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
}

function seedPrice(
  db: DatabaseSync,
  branchId: string,
  priceAgorot: number,
  observedAt: string,
  promotionId: string | null = null,
): void {
  run(
    db,
    `INSERT INTO price_history (id, product_id, chain_id, branch_id, price_agorot, currency, observed_at, source, provider_id, promotion_id, is_member_price, availability, confidence)
     VALUES (?,?,?,?,?,'ILS',?,'test','test',?,0,'unknown',1)`,
    [`ph-${branchId}-${observedAt}`, PRODUCT, 'rami-levy', branchId, priceAgorot, observedAt, promotionId],
  );
}

function setCurrent(db: DatabaseSync, branchId: string, priceAgorot: number, observedAt: string): void {
  run(
    db,
    `INSERT INTO prices (product_id, chain_id, branch_id, price_agorot, currency, is_member_price, promotion_id, availability, confidence, source, provider_id, observed_at)
     VALUES (?,?,?,?,'ILS',0,NULL,'unknown',1,'test','test',?)
     ON CONFLICT(product_id, branch_id) DO UPDATE SET price_agorot = excluded.price_agorot, observed_at = excluded.observed_at`,
    [PRODUCT, 'rami-levy', branchId, priceAgorot, observedAt],
  );
}

let db: DatabaseSync;

beforeEach(() => {
  db = createMemoryDb();
  run(db, `INSERT INTO supermarket_chains (id, name_he, name_en, updated_at) VALUES ('rami-levy','רמי לוי','Rami Levy', ?)`, [NOW]);
  for (const branchId of ['b1', 'b2']) {
    run(
      db,
      `INSERT INTO store_branches (id, chain_id, name, updated_at) VALUES (?, 'rami-levy', ?, ?)`,
      [branchId, branchId, NOW],
    );
  }
  run(
    db,
    `INSERT INTO products (id, signature, name_he, canonical_name, created_at, updated_at) VALUES (?, 'sig-coffee', 'קפה 200 גרם', 'coffee', ?, ?)`,
    [PRODUCT, NOW, NOW],
  );
});

describe('basketWatch', () => {
  it('measures the change at the branch the current price came from', () => {
    // Branch b1 is expensive and stable; branch b2 is cheap and stable. The
    // cheapest price moves from b1 to b2 only because b2 has data — that is a
    // shop difference, not a price change, and must not be reported as one.
    seedPrice(db, 'b1', 3000, daysAgo(14));
    seedPrice(db, 'b1', 3000, daysAgo(1));
    seedPrice(db, 'b2', 2000, daysAgo(14));
    seedPrice(db, 'b2', 2000, daysAgo(1));
    setCurrent(db, 'b1', 3000, daysAgo(1));
    setCurrent(db, 'b2', 2000, daysAgo(1));

    const entry = basketWatch(db, [PRODUCT], { sinceDays: 7, now: NOW })[0];
    expect(entry?.branchId).toBe('b2');
    expect(entry?.change.comparable).toBe(true);
    if (entry?.change.comparable) {
      expect(entry.change.percentageChange).toBe(0);
      expect(entry.change.direction).toBe('unchanged');
    }
  });

  it('reports a genuine move at that branch', () => {
    seedPrice(db, 'b2', 2000, daysAgo(14));
    seedPrice(db, 'b2', 2400, daysAgo(1));
    setCurrent(db, 'b2', 2400, daysAgo(1));

    const entry = basketWatch(db, [PRODUCT], { sinceDays: 7, now: NOW })[0];
    expect(entry?.change.comparable).toBe(true);
    if (entry?.change.comparable) {
      expect(entry.change.percentageChange).toBe(20);
      expect(entry.change.severity).toBe('major');
    }
  });

  it('says there is no comparison when the branch has no earlier observation', () => {
    seedPrice(db, 'b1', 2500, daysAgo(1));
    setCurrent(db, 'b1', 2500, daysAgo(1));

    const entry = basketWatch(db, [PRODUCT], { sinceDays: 7, now: NOW })[0];
    expect(entry?.change.comparable).toBe(false);
    if (entry && !entry.change.comparable) {
      expect(entry.change.reason).toBe('no_previous_observation');
    }
  });

  it('skips a product with no current price at all', () => {
    expect(basketWatch(db, [PRODUCT], { sinceDays: 7, now: NOW })).toHaveLength(0);
  });
});

describe('buildTimeline', () => {
  it('collapses to one point per day per chain and only compares within a chain', () => {
    // Two readings on the same day at the same chain collapse to the later one.
    const history = [
      { priceAgorot: 2400, observedAt: '2026-08-11T06:00:00.000Z', isPromotional: false, isMemberPrice: false, chainId: 'a', source: 't' },
      { priceAgorot: 2500, observedAt: '2026-08-11T18:00:00.000Z', isPromotional: false, isMemberPrice: false, chainId: 'a', source: 't' },
      { priceAgorot: 2700, observedAt: '2026-08-21T06:00:00.000Z', isPromotional: false, isMemberPrice: false, chainId: 'a', source: 't' },
      { priceAgorot: 1000, observedAt: '2026-08-26T06:00:00.000Z', isPromotional: false, isMemberPrice: false, chainId: 'b', source: 't' },
    ];
    const timeline = buildTimeline(history);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]?.priceAgorot).toBe(2500);
    expect(timeline[1]?.percentageChange).toBe(8);
    // The chain changes here, so no percentage is claimed.
    expect(timeline[2]?.percentageChange).toBeNull();
  });
});

describe('productIntelligence', () => {
  it('builds comparisons from stored history only', () => {
    for (let week = 12; week >= 0; week -= 1) {
      seedPrice(db, 'b1', 2400 + week * 10, daysAgo(week * 7));
    }
    setCurrent(db, 'b1', 2400, daysAgo(0));

    const intel = productIntelligence(db, PRODUCT, { now: NOW });
    expect(intel?.baseline.hasEnoughData).toBe(true);
    expect(intel?.comparisons.sevenDays?.priceAgorot).toBe(2410);
    expect(intel?.comparisons.ninetyDayAverage?.coversFullWindow).toBe(true);
    expect(intel?.advice?.verdict).toBeDefined();
  });

  it('returns null for an unknown product', () => {
    expect(productIntelligence(db, 'nope')).toBeNull();
  });

  it('scopes the baseline to the chains the user actually shops at', () => {
    run(db, `INSERT INTO supermarket_chains (id, name_he, name_en, updated_at) VALUES ('other','אחר','Other', ?)`, [NOW]);
    run(db, `INSERT INTO store_branches (id, chain_id, name, updated_at) VALUES ('b9','other','b9', ?)`, [NOW]);
    // A cheap chain the user excluded must not drag their "usual price" down.
    for (let week = 6; week >= 0; week -= 1) {
      seedPrice(db, 'b1', 3000, daysAgo(week * 7));
      run(
        db,
        `INSERT INTO price_history (id, product_id, chain_id, branch_id, price_agorot, currency, observed_at, source, provider_id, is_member_price, availability, confidence)
         VALUES (?,?,'other','b9',1000,'ILS',?,'test','test',0,'unknown',1)`,
        [`ph-other-${week}`, PRODUCT, daysAgo(week * 7)],
      );
    }
    setCurrent(db, 'b1', 3000, daysAgo(0));

    const scoped = productIntelligence(db, PRODUCT, { chainIds: ['rami-levy'], now: NOW });
    expect(scoped?.scopedChainIds).toEqual(['rami-levy']);
    expect(scoped?.baseline.usualPriceAgorot).toBe(3000);
    expect(scoped?.baseline.lowestObservedAgorot).toBe(3000);

    const unscoped = productIntelligence(db, PRODUCT, { now: NOW });
    expect(unscoped?.baseline.lowestObservedAgorot).toBe(1000);
  });
});

describe('aggregateMovement', () => {
  it('refuses to summarise a group with too few products', () => {
    seedPrice(db, 'b1', 2000, daysAgo(20));
    seedPrice(db, 'b1', 2400, daysAgo(1));
    expect(aggregateMovement(db, 'chain', { sinceDays: 30, now: NOW })).toEqual([]);
  });

  it('summarises once there are enough products', () => {
    for (let i = 0; i < 6; i += 1) {
      const productId = `p${i}`;
      run(
        db,
        `INSERT INTO products (id, signature, name_he, canonical_name, created_at, updated_at) VALUES (?, ?, ?, 'x', ?, ?)`,
        [productId, `sig-${i}`, `product ${i}`, NOW, NOW],
      );
      run(
        db,
        `INSERT INTO price_history (id, product_id, chain_id, branch_id, price_agorot, currency, observed_at, source, provider_id, is_member_price, availability, confidence)
         VALUES (?,?,'rami-levy','b1',?, 'ILS', ?, 'test','test',0,'unknown',1)`,
        [`h-${i}-old`, productId, 1000, daysAgo(20)],
      );
      run(
        db,
        `INSERT INTO price_history (id, product_id, chain_id, branch_id, price_agorot, currency, observed_at, source, provider_id, is_member_price, availability, confidence)
         VALUES (?,?,'rami-levy','b1',?, 'ILS', ?, 'test','test',0,'unknown',1)`,
        [`h-${i}-new`, productId, 1100, daysAgo(1)],
      );
    }
    const rows = aggregateMovement(db, 'chain', { sinceDays: 30, now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'rami-levy', percentageChange: 10, productCount: 6 });
  });
});

describe('loadHistory', () => {
  it('orders oldest first and respects the window', () => {
    seedPrice(db, 'b1', 2000, daysAgo(40));
    seedPrice(db, 'b1', 2100, daysAgo(10));
    const all = loadHistory(db, { productId: PRODUCT }, NOW);
    expect(all.map((p) => p.priceAgorot)).toEqual([2000, 2100]);
    const recent = loadHistory(db, { productId: PRODUCT, sinceDays: 30 }, NOW);
    expect(recent).toHaveLength(1);
  });
});

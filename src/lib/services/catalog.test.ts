import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { all, createMemoryDb, get, type Row } from '@/lib/db/client';
import { branchIdFor, ingestSnapshot, listProviderStatus, recordProviderStatus, syncChainRegistry } from './catalog';
import { DemoPriceProvider } from '@/lib/providers/demo-provider';
import type { ProviderSnapshot } from '@/lib/providers/types';

function snapshot(overrides: Partial<ProviderSnapshot> = {}): ProviderSnapshot {
  return {
    providerId: 'test-provider',
    fetchedAt: '2026-08-31T06:00:00.000Z',
    branches: [
      {
        externalBranchId: '042',
        chainId: 'rami-levy',
        name: 'Test branch',
        city: 'Tel Aviv',
        address: null,
        latitude: 32.08,
        longitude: 34.78,
        supportsDelivery: true,
        deliveryFeeAgorot: 2900,
        deliveryMinimumAgorot: 20000,
      },
    ],
    products: [
      {
        externalProductId: '7290000123456',
        barcode: '7290000123456',
        name: 'חלב תנובה 3% 1 ליטר',
        manufacturer: 'תנובה',
        brand: 'תנובה',
        category: 'dairy',
        packageText: 'ליטר',
        quantity: 1,
        unitOfMeasure: 'ליטר',
      },
    ],
    prices: [
      {
        externalProductId: '7290000123456',
        externalBranchId: '042',
        chainId: 'rami-levy',
        priceAgorot: 690,
        currency: 'ILS',
        observedAt: '2026-08-31T06:00:00.000Z',
        isMemberPrice: false,
        availability: 'unknown',
        confidence: 1,
        source: 'test',
      },
    ],
    promotions: [],
    warnings: [],
    producesRealMarketPrices: true,
    ...overrides,
  };
}

let db: DatabaseSync;

beforeEach(() => {
  db = createMemoryDb();
  syncChainRegistry(db);
});

describe('syncChainRegistry', () => {
  it('mirrors the registry into the database', () => {
    const rows = all<Row>(db, 'SELECT id, endpoint_verified FROM supermarket_chains');
    expect(rows.length).toBeGreaterThan(20);
    // Nothing in the shipped registry claims a verified endpoint.
    expect(rows.every((row) => Number(row.endpoint_verified) === 0)).toBe(true);
  });

  it('is idempotent', () => {
    const before = all<Row>(db, 'SELECT id FROM supermarket_chains').length;
    syncChainRegistry(db);
    expect(all<Row>(db, 'SELECT id FROM supermarket_chains').length).toBe(before);
  });
});

describe('ingestSnapshot', () => {
  it('writes branches, products, prices and history with their provenance', () => {
    const report = ingestSnapshot(db, snapshot());
    expect(report).toMatchObject({ branchesUpserted: 1, productsUpserted: 1, pricesWritten: 1, historyRowsWritten: 1 });

    const price = get<Row>(db, 'SELECT * FROM prices');
    expect(price).toMatchObject({
      price_agorot: 690,
      provider_id: 'test-provider',
      source: 'test',
      observed_at: '2026-08-31T06:00:00.000Z',
    });
    expect(get<Row>(db, 'SELECT COUNT(*) AS n FROM price_history')?.n).toBe(1);
  });

  it('namespaces branch ids by chain so two chains cannot collide', () => {
    expect(branchIdFor('rami-levy', '042')).toBe('rami-levy:042');
    ingestSnapshot(db, snapshot());
    expect(get<Row>(db, 'SELECT id FROM store_branches')?.id).toBe('rami-levy:042');
  });

  it('converges two spellings of the same package onto one product', () => {
    ingestSnapshot(db, snapshot());
    ingestSnapshot(
      db,
      snapshot({
        products: [
          {
            externalProductId: '7290000123456',
            barcode: '7290000123456',
            name: 'Fresh Milk 3 Percent 1000ml',
            manufacturer: 'Tnuva',
            brand: 'Tnuva',
            category: 'dairy',
            packageText: null,
            quantity: null,
            unitOfMeasure: null,
          },
        ],
      }),
    );
    expect(all<Row>(db, 'SELECT id FROM products')).toHaveLength(1);
    // Both spellings are remembered so future matching can use either.
    expect(all<Row>(db, 'SELECT alias FROM product_aliases')).toHaveLength(2);
  });

  it('appends history without overwriting it', () => {
    ingestSnapshot(db, snapshot());
    ingestSnapshot(
      db,
      snapshot({
        fetchedAt: '2026-09-07T06:00:00.000Z',
        prices: [
          {
            ...(snapshot().prices[0] as NonNullable<ReturnType<typeof snapshot>['prices'][number]>),
            priceAgorot: 750,
            observedAt: '2026-09-07T06:00:00.000Z',
          },
        ],
      }),
    );
    expect(get<Row>(db, 'SELECT COUNT(*) AS n FROM price_history')?.n).toBe(2);
    expect(get<Row>(db, 'SELECT price_agorot FROM prices')?.price_agorot).toBe(750);
  });

  it('never lets an out-of-order file move the current price backwards in time', () => {
    ingestSnapshot(db, snapshot());
    const stale = ingestSnapshot(
      db,
      snapshot({
        prices: [
          {
            ...(snapshot().prices[0] as NonNullable<ReturnType<typeof snapshot>['prices'][number]>),
            priceAgorot: 1200,
            observedAt: '2026-08-24T06:00:00.000Z',
          },
        ],
      }),
    );
    expect(stale.staleObservationsSkipped).toBe(1);
    // The current price is still the newer observation, but the older one is
    // kept in history where it belongs.
    expect(get<Row>(db, 'SELECT price_agorot FROM prices')?.price_agorot).toBe(690);
    expect(get<Row>(db, 'SELECT COUNT(*) AS n FROM price_history')?.n).toBe(2);
  });

  it('reports a price it cannot attach to a product or branch instead of dropping it silently', () => {
    const report = ingestSnapshot(
      db,
      snapshot({
        products: [],
        prices: [
          {
            ...(snapshot().prices[0] as NonNullable<ReturnType<typeof snapshot>['prices'][number]>),
            externalProductId: 'unknown',
          },
        ],
      }),
    );
    expect(report.pricesWritten).toBe(0);
    expect(report.warnings).toContain('price_without_product:unknown');
  });

  it('carries the real-market-data flag through to the report', () => {
    const demo = ingestSnapshot(db, snapshot({ producesRealMarketPrices: false }));
    expect(demo.producesRealMarketPrices).toBe(false);
  });
});

describe('recordProviderStatus', () => {
  it('keeps the last successful sync time across a later failure', () => {
    const provider = new DemoPriceProvider();
    recordProviderStatus(db, provider, { available: true, error: null, succeededAt: '2026-08-31T06:00:00.000Z' });
    recordProviderStatus(db, provider, { available: false, error: 'boom', succeededAt: null });

    const status = listProviderStatus(db).find((s) => s.providerId === 'demo-fixture');
    expect(status).toMatchObject({ available: false, lastError: 'boom', lastSuccessAt: '2026-08-31T06:00:00.000Z' });
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFeedTimestamp, parsePriceFile, parsePromoFile, parseStoresFile } from './il-transparency-parser';

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), 'src/lib/providers/__fixtures__', name), 'utf8');

const options = { chainId: 'rami-levy', source: 'test-portal', fallbackObservedAt: '2026-08-31T00:00:00Z' };

describe('parseFeedTimestamp', () => {
  it('reads the regulated "YYYY-MM-DD HH:mm" form as Israel local time', () => {
    // 06:15 in Israel summer time (UTC+3) is 03:15 UTC.
    expect(parseFeedTimestamp('2026-08-31 06:15')).toBe('2026-08-31T03:15:00.000Z');
    // 06:15 in Israel winter time (UTC+2) is 04:15 UTC.
    expect(parseFeedTimestamp('2026-01-15 06:15')).toBe('2026-01-15T04:15:00.000Z');
  });

  it('respects an explicit offset', () => {
    expect(parseFeedTimestamp('2026-08-31T06:15:00Z')).toBe('2026-08-31T06:15:00.000Z');
  });

  it('rejects anything it cannot parse rather than defaulting to now', () => {
    expect(parseFeedTimestamp('31/08/2026')).toBeNull();
    expect(parseFeedTimestamp('')).toBeNull();
    expect(parseFeedTimestamp(null)).toBeNull();
  });
});

describe('parsePriceFile', () => {
  const result = parsePriceFile(fixture('pricefull-sample.xml'), options);

  it('extracts the branch and the well-formed items', () => {
    expect(result.externalBranchId).toBe('042');
    expect(result.products).toHaveLength(2);
    expect(result.prices).toHaveLength(2);
  });

  it('converts shelf prices to agorot', () => {
    const milk = result.prices.find((p) => p.externalProductId === '7290000123456');
    expect(milk?.priceAgorot).toBe(690);
    const coffee = result.prices.find((p) => p.externalProductId === '7290000999999');
    expect(coffee?.priceAgorot).toBe(2490);
  });

  it('carries the feed timestamp, not the ingest time', () => {
    expect(result.prices[0]?.observedAt).toBe('2026-08-31T03:15:00.000Z');
  });

  it('skips unparseable rows and reports them as warnings', () => {
    expect(result.warnings).toContain('skipped_item_unparseable_price:7290000777777');
    expect(result.warnings).toContain('skipped_item_missing_identity');
  });

  it('captures manufacturer and package metadata for normalisation', () => {
    const milk = result.products.find((p) => p.externalProductId === '7290000123456');
    expect(milk).toMatchObject({ manufacturer: 'תנובה', quantity: 1, unitOfMeasure: 'ליטר', barcode: '7290000123456' });
  });

  it('never marks a shelf price as a member price', () => {
    expect(result.prices.every((p) => p.isMemberPrice === false)).toBe(true);
  });
});

describe('parsePromoFile', () => {
  const result = parsePromoFile(fixture('promofull-sample.xml'), options);

  it('classifies an N+M promotion', () => {
    const promo = result.promotions.find((p) => p.externalPromotionId === 'P-1001');
    expect(promo).toMatchObject({ kind: 'n_plus_m', buyQuantity: 1, freeQuantity: 1, requiresMembership: false });
    expect(promo?.endsAt).toBe('2026-09-06T20:59:00.000Z');
  });

  it('classifies a club price and marks it as membership-gated', () => {
    const promo = result.promotions.find((p) => p.externalPromotionId === 'P-1002');
    expect(promo).toMatchObject({ kind: 'member_price', promoUnitPriceAgorot: 540, requiresMembership: true });
  });

  it('skips a promotion whose terms it cannot classify', () => {
    expect(result.promotions.some((p) => p.externalPromotionId === 'P-1003')).toBe(false);
    expect(result.warnings).toContain('skipped_promotion_unrecognised_terms:P-1003');
  });
});

describe('parseStoresFile', () => {
  const result = parseStoresFile(fixture('stores-sample.xml'), { chainId: 'rami-levy' });

  it('reads branches with their coordinates when present', () => {
    expect(result.branches).toHaveLength(2);
    expect(result.branches[0]).toMatchObject({ externalBranchId: '042', city: 'תל אביב', latitude: 32.08 });
    expect(result.branches[1]?.latitude).toBeNull();
  });

  it('skips a branch with no identity', () => {
    expect(result.warnings).toContain('skipped_store_missing_identity');
  });
});

import { describe, expect, it } from 'vitest';
import { computeUnitPrice, isComparable, parsePackageSize } from './units';

describe('parsePackageSize', () => {
  it('parses English weights and volumes', () => {
    expect(parsePackageSize('Milk 3% 1L')).toMatchObject({ baseQuantity: 1000, baseUnit: 'ml' });
    expect(parsePackageSize('Rice 1kg')).toMatchObject({ baseQuantity: 1000, baseUnit: 'g' });
    expect(parsePackageSize('Coffee 200g')).toMatchObject({ baseQuantity: 200, baseUnit: 'g' });
    expect(parsePackageSize('Yogurt 500 ml')).toMatchObject({ baseQuantity: 500, baseUnit: 'ml' });
  });

  it('parses Hebrew weights and volumes', () => {
    expect(parsePackageSize('חלב 3% 1 ליטר')).toMatchObject({ baseQuantity: 1000, baseUnit: 'ml' });
    expect(parsePackageSize('אורז 1 ק"ג')).toMatchObject({ baseQuantity: 1000, baseUnit: 'g' });
    expect(parsePackageSize('קפה טורקי 200 גרם')).toMatchObject({ baseQuantity: 200, baseUnit: 'g' });
  });

  it('multiplies out multipacks', () => {
    expect(parsePackageSize('Cola 6 x 1.5L')).toMatchObject({ baseQuantity: 9000, baseUnit: 'ml', multipack: 6 });
  });

  it('handles decimal comma', () => {
    expect(parsePackageSize('Cheese 0,25 kg')).toMatchObject({ baseQuantity: 250, baseUnit: 'g' });
  });

  it('returns null when there is no recognisable size', () => {
    expect(parsePackageSize('Fresh vegetables')).toBeNull();
    expect(parsePackageSize('')).toBeNull();
  });

  it('does not mistake a fat percentage for a size', () => {
    const size = parsePackageSize('Milk 3%');
    expect(size).toBeNull();
  });
});

describe('computeUnitPrice', () => {
  it('normalises the specification example: ₪20/1kg vs ₪13/500g', () => {
    const a = computeUnitPrice(2000, parsePackageSize('Rice 1kg'));
    const b = computeUnitPrice(1300, parsePackageSize('Rice 500g'));
    expect(a?.perKgAgorot).toBe(2000); // ₪20 / kg
    expect(b?.perKgAgorot).toBe(2600); // ₪26 / kg
    expect(isComparable(a, b)).toBe(true);
    expect((a as { perKgAgorot: number }).perKgAgorot).toBeLessThan((b as { perKgAgorot: number }).perKgAgorot);
  });

  it('produces per-100g and per-100ml projections', () => {
    expect(computeUnitPrice(1200, parsePackageSize('Coffee 200g'))?.per100gAgorot).toBe(600);
    expect(computeUnitPrice(600, parsePackageSize('Juice 1L'))?.per100mlAgorot).toBe(60);
  });

  it('returns null rather than guessing when the size is unknown', () => {
    expect(computeUnitPrice(1200, null)).toBeNull();
  });

  it('refuses to compare across base units', () => {
    const grams = computeUnitPrice(2000, parsePackageSize('Rice 1kg'));
    const millilitres = computeUnitPrice(600, parsePackageSize('Juice 1L'));
    expect(isComparable(grams, millilitres)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { findBestMatch, normalizeProduct, normalizeText, scoreMatch, tokenize } from './normalize';

describe('normalizeText', () => {
  it('strips punctuation and case', () => {
    expect(normalizeText('Milk 3%, 1L!')).toBe('milk 3% 1l');
  });
});

describe('tokenize', () => {
  it('maps Hebrew and English spellings onto one canonical term', () => {
    expect(tokenize('Fresh Milk')).toContain('milk');
    expect(tokenize('חלב טרי')).toContain('milk');
  });
});

describe('normalizeProduct', () => {
  it('maps two spellings of the same package to the same signature', () => {
    const a = normalizeProduct({ name: 'Milk 3% 1L', brand: 'Tnuva' });
    const b = normalizeProduct({ name: 'Fresh Milk 3 Percent 1000ml', brand: 'Tnuva' });
    expect(a.size?.baseQuantity).toBe(1000);
    expect(b.size?.baseQuantity).toBe(1000);
    expect(scoreMatch(a, b).samePackage).toBe(true);
  });

  it('keeps a different package size as a different product', () => {
    const oneLitre = normalizeProduct({ name: 'Milk 3% 1L', brand: 'Tnuva' });
    const twoLitre = normalizeProduct({ name: 'Milk 3% 2L', brand: 'Tnuva' });
    expect(oneLitre.signature).not.toBe(twoLitre.signature);
    const match = scoreMatch(oneLitre, twoLitre);
    expect(match.samePackage).toBe(false);
    expect(match.score).toBeLessThanOrEqual(0.5);
  });

  it('prefers barcode identity over name similarity', () => {
    const a = normalizeProduct({ name: 'Some Coffee 200g', barcode: '7290000123456' });
    const b = normalizeProduct({ name: 'Totally different label', barcode: '7290000123456' });
    expect(scoreMatch(a, b)).toMatchObject({ score: 1, reason: 'barcode' });
  });

  it('scores different barcodes as non-matching', () => {
    const a = normalizeProduct({ name: 'Coffee 200g', barcode: '7290000123456' });
    const b = normalizeProduct({ name: 'Coffee 200g', barcode: '7290000999999' });
    expect(scoreMatch(a, b).score).toBe(0);
  });

  it('ignores implausible barcodes', () => {
    expect(normalizeProduct({ name: 'X', barcode: '12' }).barcode).toBeNull();
  });
});

describe('findBestMatch', () => {
  const catalog = [
    { name: 'חלב תנובה 3% 1 ליטר', brand: 'תנובה' },
    { name: 'Coffee Elite Turkish 200g', brand: 'Elite' },
    { name: 'Rice Sugat 1kg', brand: 'Sugat' },
  ].map((raw) => ({ item: raw.name, normalized: normalizeProduct(raw) }));

  it('accepts a confident match', () => {
    const query = normalizeProduct({ name: 'Coffee Elite Turkish 200 g', brand: 'Elite' });
    const outcome = findBestMatch(query, catalog);
    expect(outcome.accepted).toBe(true);
    expect(outcome.best?.item).toBe('Coffee Elite Turkish 200g');
  });

  it('declines to match something absent from the catalog', () => {
    const query = normalizeProduct({ name: 'Motor oil 5W30 4L' });
    const outcome = findBestMatch(query, catalog);
    expect(outcome.accepted).toBe(false);
  });
});

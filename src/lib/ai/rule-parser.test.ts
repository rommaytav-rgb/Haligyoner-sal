import { describe, expect, it } from 'vitest';
import { extractQuantity, parseBasketTextWithRules, splitLines } from './rule-parser';

describe('splitLines', () => {
  it('splits a multi-line list', () => {
    expect(splitLines('חלב\nביצים\nלחם')).toEqual(['חלב', 'ביצים', 'לחם']);
  });

  it('splits a comma-separated single line', () => {
    expect(splitLines('milk, eggs, bread')).toEqual(['milk', 'eggs', 'bread']);
  });

  it('keeps a single item intact', () => {
    expect(splitLines('חלב תנובה 3%')).toEqual(['חלב תנובה 3%']);
  });
});

describe('extractQuantity', () => {
  it('reads a leading count', () => {
    expect(extractQuantity('3 חלב')).toMatchObject({ quantity: 3, text: 'חלב', source: 'explicit' });
    expect(extractQuantity('2 x milk')).toMatchObject({ quantity: 2, text: 'milk' });
  });

  it('reads a trailing count', () => {
    expect(extractQuantity('milk x3')).toMatchObject({ quantity: 3, text: 'milk' });
  });

  it('keeps a package size in the text', () => {
    const result = extractQuantity('1 ליטר חלב');
    expect(result.text).toContain('ליטר');
    expect(result.quantity).toBe(1);
  });

  it('treats a weight as a quantity while keeping the unit visible', () => {
    const result = extractQuantity('2 קילו עוף');
    expect(result.quantity).toBe(2);
    expect(result.text).toContain('קילו');
  });

  it('defaults to one', () => {
    expect(extractQuantity('לחם')).toMatchObject({ quantity: 1, source: 'default' });
  });
});

describe('parseBasketTextWithRules', () => {
  it('parses a realistic Hebrew shopping list', () => {
    const result = parseBasketTextWithRules(`- 4 חלב 3% 1 ליטר
- ביצים L
- 2 חזה עוף טרי
- קפה טורקי עלית — לא להחליף
- קורנפלקס, אם יש`);
    expect(result.items).toHaveLength(5);
    expect(result.items[0]).toMatchObject({ quantity: 4 });
    expect(result.items[1]).toMatchObject({ quantity: 1, rawText: 'ביצים L' });
    expect(result.items[3]).toMatchObject({ isLocked: true, substitutionPolicy: 'never' });
    expect(result.items[4]).toMatchObject({ isOptional: true });
  });

  it('parses an English list', () => {
    const result = parseBasketTextWithRules('milk x2, eggs, bread, coffee - do not replace');
    expect(result.items.map((i) => i.rawText)).toEqual(['milk', 'eggs', 'bread', 'coffee']);
    expect(result.items[0]?.quantity).toBe(2);
    expect(result.items[3]?.isLocked).toBe(true);
  });

  it('warns instead of inventing items for unusable input', () => {
    expect(parseBasketTextWithRules('   ').items).toHaveLength(0);
    const result = parseBasketTextWithRules('.');
    expect(result.items).toHaveLength(1);
  });
});

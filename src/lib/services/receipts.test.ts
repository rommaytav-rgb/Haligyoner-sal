import { describe, expect, it } from 'vitest';
import { extractReceipt } from './receipts';

describe('extractReceipt', () => {
  const receipt = `רמי לוי שיווק השקמה
תאריך 24/08/2026
חלב תנובה 3% 1 ליטר      6.90
2 x ביצים L               15.90
קפה טורקי עלית 200 גרם    24.90
הנחה מבצע                -5.00
סה"כ לתשלום              42.70`;

  it('extracts lines, quantities and prices in agorot', () => {
    const result = extractReceipt(receipt);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({ rawText: 'חלב תנובה 3% 1 ליטר', priceAgorot: 690 });
    expect(result.lines[1]).toMatchObject({ quantity: 2, priceAgorot: 1590 });
  });

  it('attaches a discount to the line above it', () => {
    const result = extractReceipt(receipt);
    expect(result.lines[2]?.discountAgorot).toBe(500);
  });

  it('reads the total and the purchase date', () => {
    const result = extractReceipt(receipt);
    expect(result.totalAgorot).toBe(4270);
    expect(result.purchasedAt).toBe('2026-08-24T00:00:00.000Z');
  });

  it('reports failure honestly when nothing can be extracted', () => {
    const result = extractReceipt('a scanned image with no text');
    expect(result.lines).toHaveLength(0);
    expect(result.warnings).toContain('no_lines_extracted');
    expect(result.totalAgorot).toBeNull();
  });

  it('does not invent a total that is not printed', () => {
    const result = extractReceipt('חלב 6.90\nלחם 7.80');
    expect(result.lines).toHaveLength(2);
    expect(result.totalAgorot).toBeNull();
  });
});

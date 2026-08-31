import { describe, expect, it } from 'vitest';
import {
  agorotToShekels,
  formatAgorot,
  formatAgorotDelta,
  multiplyAgorot,
  MoneyError,
  shekelsToAgorot,
  sumAgorot,
} from './money';

describe('money', () => {
  it('converts shekels to agorot without float drift', () => {
    expect(shekelsToAgorot(24.9)).toBe(2490);
    expect(shekelsToAgorot(0.1)).toBe(10);
    expect(shekelsToAgorot(1.005)).toBe(101);
    expect(shekelsToAgorot(-2.5)).toBe(-250);
  });

  it('round-trips through shekels for display', () => {
    expect(agorotToShekels(2490)).toBeCloseTo(24.9, 10);
  });

  it('sums exactly where floats would drift', () => {
    const tenAgorot = Array.from({ length: 10 }, () => 10);
    expect(sumAgorot(tenAgorot)).toBe(100);
    // The float equivalent of this sum is 0.9999999999999999.
    expect(sumAgorot(Array.from({ length: 3 }, () => shekelsToAgorot(0.1)))).toBe(30);
  });

  it('rejects non-integer agorot', () => {
    expect(() => sumAgorot([10.5])).toThrow(MoneyError);
  });

  it('multiplies by fractional quantities', () => {
    expect(multiplyAgorot(1000, 1.5)).toBe(1500);
    expect(multiplyAgorot(333, 3)).toBe(999);
    expect(() => multiplyAgorot(100, -1)).toThrow(MoneyError);
  });

  it('formats shekels for display', () => {
    expect(formatAgorot(1200)).toBe('₪12');
    expect(formatAgorot(1234)).toBe('₪12.34');
    expect(formatAgorot(-250)).toBe('−₪2.50');
    expect(formatAgorotDelta(200)).toBe('+₪2');
    expect(formatAgorotDelta(-200)).toBe('−₪2');
    expect(formatAgorotDelta(0)).toBe('₪0');
  });
});

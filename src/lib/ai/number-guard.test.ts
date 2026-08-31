import { describe, expect, it } from 'vitest';
import { allowedNumbersFrom, checkNumbers, extractNumbers } from './number-guard';

describe('extractNumbers', () => {
  it('finds numbers in Hebrew and English prose', () => {
    // The Hebrew maqaf in "ב-14" is a prefix, not a minus sign.
    expect(extractNumbers('הסל שלך ירד ב-14 ש"ח (2.3%)')).toEqual([14, 2.3]);
    expect(extractNumbers('Coffee rose 29.2% to ₪31')).toEqual([29.2, 31]);
    expect(extractNumbers('the change was -2.3% this week')).toEqual([-2.3]);
  });
});

describe('number guard', () => {
  const facts = {
    absoluteChangeAgorot: -1400,
    percentageChange: -2.3,
    biggest: [{ displayName: 'Coffee', currentTotalAgorot: 3100, unitPercentageChange: 29.2 }],
  };
  const allowed = allowedNumbersFrom(facts);

  it('accepts text restating the supplied facts', () => {
    expect(checkNumbers('הסל ירד ב-14 ש"ח, כלומר 2.3%. הקפה עלה ב-29.2% ל-31 ש"ח.', allowed).ok).toBe(true);
  });

  it('rejects a number that was never computed', () => {
    const result = checkNumbers('Your basket dropped ₪14, and next week it will fall another ₪27.', allowed);
    expect(result.ok).toBe(false);
    expect(result.offending).toContain(27);
  });

  it('allows small integers used in ordinary prose', () => {
    expect(checkNumbers('4 products increased and 7 decreased.', allowed).ok).toBe(true);
  });

  it('accepts an agorot amount quoted in shekels', () => {
    expect(checkNumbers('Coffee now costs ₪31.', allowed).ok).toBe(true);
  });

  it('rejects a plausible-looking but unsupported percentage', () => {
    expect(checkNumbers('Coffee rose 31.4%.', allowed).ok).toBe(false);
  });
});

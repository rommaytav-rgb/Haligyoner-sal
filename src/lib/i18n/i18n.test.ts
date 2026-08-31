import { describe, expect, it } from 'vitest';
import { en } from './en';
import { he } from './he';
import { createTranslator, dir, formatPercent, isLocale, translate } from './index';

describe('dictionaries', () => {
  it('cover exactly the same keys in both languages', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(he)) expect(value.length, `he:${key}`).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(en)) expect(value.length, `en:${key}`).toBeGreaterThan(0);
  });

  it('keeps placeholders consistent between languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(he[key]), `placeholders for ${key}`).toEqual(placeholders(en[key]));
    }
  });
});

describe('translate', () => {
  it('returns Hebrew by default and English on request', () => {
    expect(translate('he', 'common.tagline')).toBe('חוסכים כסף בכל קנייה.');
    expect(translate('en', 'common.tagline')).toBe('Save money on every shop.');
  });

  it('substitutes parameters', () => {
    expect(translate('en', 'dashboard.increasedCount', { count: 4 })).toBe('4 products increased');
    expect(translate('he', 'dashboard.increasedCount', { count: 4 })).toBe('4 מוצרים התייקרו');
  });

  it('leaves an unknown placeholder untouched', () => {
    expect(translate('en', 'dashboard.increasedCount', { other: 1 })).toContain('{count}');
  });

  it('creates a bound translator', () => {
    const t = createTranslator('he');
    expect(t('nav.basket')).toBe('הסל שלי');
  });
});

describe('locale helpers', () => {
  it('reports direction', () => {
    expect(dir('he')).toBe('rtl');
    expect(dir('en')).toBe('ltr');
  });

  it('validates locales', () => {
    expect(isLocale('he')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('formatPercent', () => {
  it('formats signed percentages', () => {
    expect(formatPercent(29.16)).toBe('+29.2%');
    expect(formatPercent(-16.666)).toBe('−16.7%');
    expect(formatPercent(0)).toBe('0%');
  });
});

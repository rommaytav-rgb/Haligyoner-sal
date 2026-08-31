/**
 * Permanent notice shown whenever any figure on screen came from the synthetic
 * demo dataset. The product's most important asset is trust, so this is never
 * dismissible and never suppressed.
 */

import { translate, type Locale } from '@/lib/i18n';

export function DemoDataBanner({ locale }: { locale: Locale }) {
  return (
    <div
      role="status"
      style={{
        background: 'var(--color-warn-soft)',
        borderBlockEnd: '1px solid #f5c86b',
        color: 'var(--color-warn)',
        padding: '0.6rem 1rem',
        fontSize: '0.875rem',
        lineHeight: 1.5,
      }}
    >
      <strong>{translate(locale, 'data.demoBannerTitle')}</strong>{' '}
      <span>{translate(locale, 'data.demoBannerBody')}</span>
    </div>
  );
}

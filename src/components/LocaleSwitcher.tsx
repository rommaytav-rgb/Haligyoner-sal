'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { translate, type Locale } from '@/lib/i18n';

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (next: Locale) => {
    startTransition(async () => {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  };

  return (
    <div role="group" aria-label={translate(locale, 'common.language')} style={{ display: 'flex', gap: '0.25rem' }}>
      {(['he', 'en'] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={pending || option === locale}
          onClick={() => switchTo(option)}
          className="pill"
          style={{
            border: '1px solid var(--color-line)',
            background: option === locale ? 'var(--color-brand-soft)' : 'transparent',
            color: option === locale ? 'var(--color-brand)' : 'var(--color-ink-soft)',
            cursor: option === locale ? 'default' : 'pointer',
          }}
        >
          {translate(locale, option === 'he' ? 'common.hebrew' : 'common.english')}
        </button>
      ))}
    </div>
  );
}

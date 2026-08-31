'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createTranslator, type Locale } from '@/lib/i18n';

/** Data-rights controls: export everything, delete history, delete the account. */
export function PrivacyPanel({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function remove(scope: 'history' | 'receipts' | 'account') {
    if (scope === 'account' && !window.confirm(t('settings.deleteAccountConfirm'))) return;
    setPending(scope);
    try {
      await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      if (scope === 'account') router.push('/');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{t('settings.privacy')}</h2>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <a className="btn btn-secondary" href="/api/account/export" download>
          {t('settings.exportData')}
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => remove('history')} disabled={pending !== null}>
          {t('settings.deleteHistory')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ color: 'var(--color-rise)', borderColor: 'var(--color-rise)' }}
          onClick={() => remove('account')}
          disabled={pending !== null}
        >
          {t('settings.deleteAccount')}
        </button>
      </div>
    </section>
  );
}

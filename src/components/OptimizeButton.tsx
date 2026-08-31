'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createTranslator, type Locale } from '@/lib/i18n';

/**
 * Runs a persisted optimization: it writes a basket snapshot and records the
 * savings, which is what later week-over-week comparisons are built from.
 */
export function OptimizeButton({ basketId, locale }: { basketId: string; locale: Locale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function optimize() {
    setPending(true);
    setError(false);
    try {
      const response = await fetch(`/api/basket/${basketId}/optimize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ persist: true }),
      });
      if (!response.ok) setError(true);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {error && <span style={{ color: 'var(--color-rise)', fontSize: '0.85rem' }}>{t('common.error')}</span>}
      <button type="button" className="btn btn-primary" onClick={optimize} disabled={pending}>
        {pending ? t('common.loading') : t('dashboard.optimizeNow')}
      </button>
    </div>
  );
}

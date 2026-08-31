'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createTranslator, type Locale } from '@/lib/i18n';

export function ReceiptImport({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<{ status: string; lineCount: number; matchedLineCount: number } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (text.trim().length === 0) return;
    setPending(true);
    setOutcome(null);
    try {
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const body = (await response.json()) as {
        receipt?: { status: string; lineCount: number; matchedLineCount: number };
      };
      if (body.receipt) {
        setOutcome(body.receipt);
        // Only clear the box on a successful extraction, so a failed paste is not lost.
        if (body.receipt.status !== 'failed') setText('');
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '0.6rem' }}>
      <p style={{ margin: 0, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>{t('receipts.intro')}</p>
      <textarea
        aria-label={t('receipts.title')}
        className="field"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('receipts.placeholder')}
        style={{ resize: 'vertical', lineHeight: 1.6, fontFamily: 'ui-monospace, monospace' }}
      />
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-warn)' }}>{t('receipts.noOcr')}</p>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={pending || text.trim().length === 0}>
          {pending ? t('common.loading') : t('receipts.import')}
        </button>
        {outcome && (
          <span
            style={{
              fontSize: '0.875rem',
              color: outcome.status === 'failed' ? 'var(--color-rise)' : 'var(--color-ink-soft)',
            }}
          >
            {outcome.status === 'failed'
              ? t('receipts.statusFailed')
              : `${t('receipts.lines', { count: outcome.lineCount })} · ${t('receipts.matched', {
                  count: outcome.matchedLineCount,
                })}`}
          </span>
        )}
      </div>
    </form>
  );
}

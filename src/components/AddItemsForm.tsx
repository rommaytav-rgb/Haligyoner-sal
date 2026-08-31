'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createTranslator, type Locale } from '@/lib/i18n';

/**
 * Natural-language entry point. The text is sent to the server, which structures
 * it (with the assistant when configured, deterministically otherwise) and
 * reports which path was used so the user is never misled about it.
 */
export function AddItemsForm({ basketId, locale }: { basketId: string; locale: Locale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ added: number; unmatched: number; parsedBy: string } | null>(null);
  const [error, setError] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (text.trim().length === 0) return;
    setPending(true);
    setError(false);
    setResult(null);
    try {
      const response = await fetch(`/api/basket/${basketId}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      const body = (await response.json()) as {
        added: unknown[];
        unmatched: unknown[];
        parsedBy: string;
      };
      setResult({ added: body.added.length, unmatched: body.unmatched.length, parsedBy: body.parsedBy });
      setText('');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '0.6rem' }}>
      <label className="label" htmlFor="basket-text">
        {t('basket.naturalLanguagePrompt')}
      </label>
      <textarea
        id="basket-text"
        className="field"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('basket.naturalLanguagePlaceholder')}
        style={{ resize: 'vertical', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={pending || text.trim().length === 0}>
          {pending ? t('common.loading') : t('basket.parse')}
        </button>
        {result && (
          <span style={{ fontSize: '0.875rem', color: 'var(--color-ink-soft)' }}>
            {t('basket.itemCount', { count: result.added })}
            {' · '}
            {t(result.parsedBy === 'ai' ? 'basket.parsedByAi' : 'basket.parsedByRules')}
            {result.unmatched > 0 && ` · ${t('basket.unmatched')}: ${result.unmatched}`}
          </span>
        )}
        {error && <span style={{ color: 'var(--color-rise)', fontSize: '0.875rem' }}>{t('common.error')}</span>}
      </div>
    </form>
  );
}

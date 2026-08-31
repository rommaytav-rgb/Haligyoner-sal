'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BasketItem, SubstitutionPolicy } from '@/lib/services/baskets';
import { createTranslator, type Locale } from '@/lib/i18n';

export function BasketItemRow({
  item,
  basketId,
  locale,
}: {
  item: BasketItem;
  basketId: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);

  async function patch(body: Record<string, unknown>) {
    setPending(true);
    try {
      await fetch(`/api/basket/${basketId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await fetch(`/api/basket/${basketId}/items/${item.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <li
      style={{
        display: 'grid',
        gap: '0.5rem',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'start',
        padding: '0.75rem 0',
        borderBlockEnd: '1px solid var(--color-line)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.displayName}</div>
        {/* The user's own wording is always kept and shown when it differs. */}
        {item.rawText !== item.displayName && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)', overflowWrap: 'anywhere' }}>
            “{item.rawText}”
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBlockStart: '0.4rem' }}>
          {item.productId === null && (
            <span className="pill" style={{ background: 'var(--color-warn-soft)', color: 'var(--color-warn)' }}>
              {t('basket.unmatched')}
            </span>
          )}
          {item.isLocked && (
            <span className="pill" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
              🔒 {t('basket.locked')}
            </span>
          )}
          {item.isOptional && (
            <span className="pill" style={{ background: 'var(--color-surface-muted)', color: 'var(--color-flat)' }}>
              {t('basket.optional')}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <label className="label" htmlFor={`qty-${item.id}`} style={{ margin: 0 }}>
          {t('basket.quantity')}
        </label>
        <input
          id={`qty-${item.id}`}
          className="field"
          type="number"
          min={0.1}
          step={0.1}
          value={quantity}
          disabled={pending}
          onChange={(e) => setQuantity(Number(e.target.value))}
          onBlur={() => quantity !== item.quantity && quantity > 0 && patch({ quantity })}
          style={{ width: '5rem', padding: '0.35rem 0.5rem' }}
        />
        <select
          aria-label={t('basket.substitution')}
          className="field"
          value={item.substitutionPolicy}
          disabled={pending}
          onChange={(e) => {
            const policy = e.target.value as SubstitutionPolicy;
            patch({ substitutionPolicy: policy, isLocked: policy === 'never' });
          }}
          style={{ width: 'auto', padding: '0.35rem 0.5rem' }}
        >
          <option value="allow">{t('basket.substitutionAllow')}</option>
          <option value="same_brand_only">{t('basket.substitutionSameBrand')}</option>
          <option value="never">{t('basket.substitutionNever')}</option>
        </select>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.6rem' }}
          onClick={remove}
          disabled={pending}
        >
          {t('common.delete')}
        </button>
      </div>
    </li>
  );
}

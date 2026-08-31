'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AlertKind, AlertRule } from '@/lib/domain/alerts';
import { formatAgorot, shekelsToAgorot } from '@/lib/domain/money';
import { createTranslator, type Locale, type TranslationKey } from '@/lib/i18n';

const KIND_LABEL: Record<AlertKind, TranslationKey> = {
  price_below: 'alerts.kindPriceBelow',
  price_increase_percent: 'alerts.kindPriceIncrease',
  price_decrease_percent: 'alerts.kindPriceDecrease',
  promotion_appears: 'alerts.kindPromotionAppears',
  promotion_ends: 'alerts.kindPromotionEnds',
  historical_low: 'alerts.kindHistoricalLow',
  basket_increase_above: 'alerts.kindBasketIncrease',
  basket_decrease_below: 'alerts.kindBasketDecrease',
};

/** Kinds whose threshold is money rather than a percentage. */
const MONEY_KINDS: AlertKind[] = ['price_below', 'basket_increase_above', 'basket_decrease_below'];
const NO_THRESHOLD_KINDS: AlertKind[] = ['promotion_appears', 'promotion_ends', 'historical_low'];

export function AlertsPanel({
  alerts,
  products,
  basketId,
  locale,
}: {
  alerts: AlertRule[];
  products: Array<{ id: string; name: string }>;
  basketId: string | null;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [kind, setKind] = useState<AlertKind>('price_increase_percent');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [threshold, setThreshold] = useState('10');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const isBasketKind = kind === 'basket_increase_above' || kind === 'basket_decrease_below';
  const isMoney = MONEY_KINDS.includes(kind);
  const needsThreshold = !NO_THRESHOLD_KINDS.includes(kind);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(false);
    try {
      const numeric = Number(threshold.replace(',', '.'));
      // Money thresholds are entered in shekels and stored in agorot.
      const thresholdValue = needsThreshold ? (isMoney ? shekelsToAgorot(numeric) : numeric) : 0;
      const label = t(KIND_LABEL[kind]);
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          productId: isBasketKind ? null : productId || null,
          basketId: isBasketKind ? basketId : null,
          thresholdValue,
          label,
        }),
      });
      if (!response.ok) setError(true);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  async function toggle(alert: AlertRule) {
    await fetch(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !alert.enabled }),
    });
    router.refresh();
  }

  async function remove(alert: AlertRule) {
    await fetch(`/api/alerts/${alert.id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <form onSubmit={create} className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{t('alerts.create')}</h2>

        <div>
          <label className="label" htmlFor="alert-kind">
            {t('alerts.kind')}
          </label>
          <select id="alert-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as AlertKind)}>
            {(Object.keys(KIND_LABEL) as AlertKind[]).map((option) => (
              <option key={option} value={option}>
                {t(KIND_LABEL[option])}
              </option>
            ))}
          </select>
        </div>

        {!isBasketKind && (
          <div>
            <label className="label" htmlFor="alert-product">
              {t('alerts.product')}
            </label>
            <select
              id="alert-product"
              className="field"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {needsThreshold && (
          <div>
            <label className="label" htmlFor="alert-threshold">
              {t('alerts.threshold')} {isMoney ? '(₪)' : '(%)'}
            </label>
            <input
              id="alert-threshold"
              className="field"
              type="number"
              min={0}
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              dir="ltr"
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || (!isBasketKind && products.length === 0)}
          >
            {pending ? t('common.loading') : t('common.add')}
          </button>
          {error && <span style={{ color: 'var(--color-rise)', fontSize: '0.875rem' }}>{t('common.error')}</span>}
        </div>
      </form>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('alerts.title')}</h2>
        {alerts.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('alerts.empty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
            {alerts.map((alert) => (
              <li
                key={alert.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  paddingBlockEnd: '0.6rem',
                  borderBlockEnd: '1px solid var(--color-line)',
                }}
              >
                <span>
                  <strong>{t(KIND_LABEL[alert.kind])}</strong>
                  {!NO_THRESHOLD_KINDS.includes(alert.kind) && (
                    <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
                      {' — '}
                      {MONEY_KINDS.includes(alert.kind)
                        ? formatAgorot(alert.thresholdValue, locale)
                        : `${alert.thresholdValue}%`}
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', gap: '0.4rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }} onClick={() => toggle(alert)}>
                    {alert.enabled ? t('common.yes') : t('common.no')}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem' }} onClick={() => remove(alert)}>
                    {t('common.delete')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

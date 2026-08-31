import { AddItemsForm } from '@/components/AddItemsForm';
import { BasketItemRow } from '@/components/BasketItemRow';
import { PlanView } from '@/components/PlanView';
import { OptimizeButton } from '@/components/OptimizeButton';
import { ModeComparison } from '@/components/ModeComparison';
import { createTranslator } from '@/lib/i18n';
import { createBasket, getDefaultBasket } from '@/lib/services/baskets';
import { optimizeBasket } from '@/lib/services/pricing';
import { requireUser } from '@/lib/server/context';

export default async function BasketPage() {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);

  const basket =
    getDefaultBasket(db, user.id) ??
    createBasket(db, user.id, locale === 'en' ? 'My weekly basket' : 'הסל השבועי שלי');

  const summary = basket.items.length > 0 ? optimizeBasket(db, user.id, basket, { persist: false }) : null;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{basket.name}</h1>
        {basket.items.length > 0 && <OptimizeButton basketId={basket.id} locale={locale} />}
      </header>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('basket.addItems')}</h2>
        <AddItemsForm basketId={basket.id} locale={locale} />
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>
          {t('basket.title')}{' '}
          <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400, fontSize: '0.9rem' }}>
            {t('basket.itemCount', { count: basket.items.length })}
          </span>
        </h2>
        {basket.items.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('basket.empty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {basket.items.map((item) => (
              <BasketItemRow key={item.id} item={item} basketId={basket.id} locale={locale} />
            ))}
          </ul>
        )}
        {basket.items.some((item) => item.productId === null) && (
          <p style={{ margin: '0.75rem 0 0', color: 'var(--color-ink-soft)', fontSize: '0.875rem' }}>
            {t('basket.unmatchedBody')}
          </p>
        )}
      </section>

      {summary?.outcome.recommended && (
        <>
          <section className="card">
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('optimize.compareOptions')}</h2>
            <ModeComparison outcome={summary.outcome} locale={locale} />
          </section>

          <section className="card">
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('optimize.recommended')}</h2>
            <PlanView plan={summary.outcome.recommended} locale={locale} />
          </section>
        </>
      )}

      {summary && !summary.outcome.recommended && (
        <p className="card" style={{ margin: 0, color: 'var(--color-warn)' }}>{t('optimize.noPlan')}</p>
      )}
    </div>
  );
}

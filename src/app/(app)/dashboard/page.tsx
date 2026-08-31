import Link from 'next/link';
import { ChangePill, PriceChangeView } from '@/components/PriceChange';
import { StatCard } from '@/components/StatCard';
import { OptimizeButton } from '@/components/OptimizeButton';
import { formatAgorot, formatAgorotDelta } from '@/lib/domain/money';
import { createTranslator, formatDate, type TranslationKey } from '@/lib/i18n';
import { loadDashboard } from '@/lib/services/dashboard';
import { requireUser } from '@/lib/server/context';

const BASELINE_LABEL: Record<string, TranslationKey> = {
  cheapest_single_store: 'optimize.baselineCheapestSingleStore',
  selected_store: 'optimize.baselineSelectedStore',
  previous_basket: 'optimize.baselinePreviousBasket',
  usual_basket: 'optimize.baselineUsualBasket',
  verified_purchase: 'optimize.baselineVerifiedPurchase',
};

export default async function DashboardPage() {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);
  const data = loadDashboard(db, user.id);

  if (!data.basket) {
    return (
      <section className="card" style={{ display: 'grid', gap: '0.75rem', justifyItems: 'start' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{t('dashboard.title')}</h1>
        <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('dashboard.noBasket')}</p>
        <Link href="/basket" className="btn btn-primary">
          {t('dashboard.createBasket')}
        </Link>
      </section>
    );
  }

  const recommended = data.outcome?.recommended ?? null;
  const oneStore = data.outcome?.oneStore ?? null;
  const bestSaving = [...data.savings].sort((a, b) => b.savingAgorot - a.savingAgorot)[0] ?? null;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{t('dashboard.title')}</h1>
        <OptimizeButton basketId={data.basket.id} locale={locale} />
      </header>

      {!recommended ? (
        <p className="card" style={{ margin: 0, color: 'var(--color-warn)' }}>{t('optimize.noPlan')}</p>
      ) : (
        <>
          <section
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            }}
          >
            <StatCard
              label={t('dashboard.usualBasket')}
              value={oneStore ? formatAgorot(oneStore.payableTotalAgorot, locale) : '—'}
              note={oneStore?.legs[0]?.branch.chainName}
            />
            <StatCard
              label={t('dashboard.optimized')}
              value={formatAgorot(recommended.payableTotalAgorot, locale)}
              note={t('optimize.storeCount', { count: recommended.storeCount })}
              tone="good"
            />
            <StatCard
              label={t('dashboard.potentialSaving')}
              value={bestSaving ? formatAgorot(Math.max(0, bestSaving.savingAgorot), locale) : formatAgorot(0, locale)}
              note={
                bestSaving
                  ? t('optimize.savingVs', {
                      amount: formatAgorot(Math.max(0, bestSaving.savingAgorot), locale),
                      baseline: t(BASELINE_LABEL[bestSaving.baseline] ?? 'optimize.baselineUsualBasket'),
                    })
                  : undefined
              }
              tone="good"
            />
          </section>

          {data.coverage && data.coverage.coveredLineCount < data.coverage.requestedLineCount && (
            <section className="card" style={{ background: 'var(--color-warn-soft)', borderColor: '#f5c86b' }}>
              <strong style={{ color: 'var(--color-warn)' }}>{t('dashboard.coverageGap')}</strong>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--color-ink-soft)' }}>
                {t('dashboard.coverageGapBody', {
                  count: data.coverage.requestedLineCount - data.coverage.coveredLineCount,
                })}
              </p>
            </section>
          )}
        </>
      )}

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('dashboard.whatChanged')}</h2>
        {!data.comparison ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('dashboard.firstRun')}</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span className="num" style={{ fontSize: '1.15rem' }}>
                {formatAgorot(data.comparison.previousTotalAgorot, locale)} →{' '}
                {formatAgorot(data.comparison.currentTotalAgorot, locale)}
              </span>
              {data.comparison.percentageChange !== null && (
                <ChangePill direction={data.comparison.direction} percentage={data.comparison.percentageChange} />
              )}
              <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
                {formatAgorotDelta(data.comparison.absoluteChangeAgorot, locale)}
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.25rem', color: 'var(--color-ink-soft)' }}>
              <li>{t('dashboard.increasedCount', { count: data.comparison.counts.increased })}</li>
              <li>{t('dashboard.decreasedCount', { count: data.comparison.counts.decreased })}</li>
              {data.comparison.counts.promotionsAppeared > 0 && (
                <li>{t('dashboard.promotionsFound', { count: data.comparison.counts.promotionsAppeared })}</li>
              )}
              {data.comparison.counts.promotionsEnded > 0 && (
                <li>{t('dashboard.promotionsEnded', { count: data.comparison.counts.promotionsEnded })}</li>
              )}
            </ul>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
              {t('dashboard.sinceLastWeek')}: {formatDate(data.comparison.previousCapturedAt, locale)} →{' '}
              {formatDate(data.comparison.currentCapturedAt, locale)}
            </p>
          </div>
        )}
      </section>

      {data.movements && (
        <section className="card">
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>🔥 {t('dashboard.watch')}</h2>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[...data.movements.rising.slice(0, 3), ...data.movements.falling.slice(0, 3)].map((entry) => (
              <div
                key={entry.productId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  paddingBlock: '0.35rem',
                  borderBlockEnd: '1px solid var(--color-line)',
                }}
              >
                <Link href={`/product/${entry.productId}`} style={{ color: 'inherit', fontWeight: 600 }}>
                  {entry.displayName}
                </Link>
                <PriceChangeView change={entry.change} locale={locale} />
              </div>
            ))}
            {data.movements.rising.length === 0 && data.movements.falling.length === 0 && (
              <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('common.notEnoughData')}</p>
            )}
          </div>
          <Link href="/watch" style={{ display: 'inline-block', marginBlockStart: '0.75rem', color: 'var(--color-brand)', fontWeight: 600 }}>
            {t('nav.priceWatch')} →
          </Link>
        </section>
      )}
    </div>
  );
}

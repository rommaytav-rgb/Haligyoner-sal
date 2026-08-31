import Link from 'next/link';
import { ChangePill } from '@/components/PriceChange';
import { StatCard } from '@/components/StatCard';
import { formatAgorot, formatAgorotDelta } from '@/lib/domain/money';
import { factsFromSummary, templateExplanation } from '@/lib/ai/explain';
import { createTranslator, formatDate } from '@/lib/i18n';
import { getDefaultBasket } from '@/lib/services/baskets';
import { optimizeBasket } from '@/lib/services/pricing';
import { latestComparison, savingsSummary } from '@/lib/services/report';
import { getPreferences } from '@/lib/services/users';
import { requireUser } from '@/lib/server/context';

export default async function ReportPage() {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);
  const basket = getDefaultBasket(db, user.id);
  const rollup = savingsSummary(db, user.id);

  if (!basket) {
    return (
      <section className="card">
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>{t('report.title')}</h1>
        <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('dashboard.noBasket')}</p>
      </section>
    );
  }

  const preferences = getPreferences(db, user.id);
  const summary = basket.items.length > 0 ? optimizeBasket(db, user.id, basket, { persist: false }) : null;
  const comparison = latestComparison(db, basket.id, preferences.severityThresholds);
  const recommended = summary?.outcome.recommended ?? null;
  const oneStore = summary?.outcome.oneStore ?? null;
  const bestSaving = [...(summary?.savings ?? [])].sort((a, b) => b.savingAgorot - a.savingAgorot)[0] ?? null;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{t('report.title')}</h1>

      <section
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
        }}
      >
        <StatCard
          label={t('report.usualBasket')}
          value={oneStore ? formatAgorot(oneStore.payableTotalAgorot, locale) : '—'}
        />
        <StatCard
          label={t('report.bestAvailable')}
          value={recommended ? formatAgorot(recommended.payableTotalAgorot, locale) : '—'}
          tone="good"
        />
        <StatCard
          label={`💰 ${t('report.potentialSaving')}`}
          value={bestSaving ? formatAgorot(Math.max(0, bestSaving.savingAgorot), locale) : formatAgorot(0, locale)}
          tone="good"
        />
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('report.priceChanges')}</h2>
        {!comparison ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('report.noPreviousBasket')}</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {/* The prose is generated from the computed facts, never the other way round. */}
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              {templateExplanation(factsFromSummary(comparison.summary), locale)}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span className="num">
                {formatAgorot(comparison.summary.previousTotalAgorot, locale)} →{' '}
                {formatAgorot(comparison.summary.currentTotalAgorot, locale)}
              </span>
              {comparison.summary.percentageChange !== null && (
                <ChangePill
                  direction={comparison.summary.direction}
                  percentage={comparison.summary.percentageChange}
                />
              )}
              <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
                {formatAgorotDelta(comparison.summary.absoluteChangeAgorot, locale)}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
                {formatDate(comparison.summary.previousCapturedAt, locale)} →{' '}
                {formatDate(comparison.summary.currentCapturedAt, locale)}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
              }}
            >
              <ContributorList
                title={`🔴 ${t('report.biggestIncrease')}`}
                lines={comparison.summary.biggestIncreases.slice(0, 3)}
                locale={locale}
                empty={t('common.none')}
              />
              <ContributorList
                title={`🟢 ${t('report.biggestDecrease')}`}
                lines={comparison.summary.biggestDecreases.slice(0, 3)}
                locale={locale}
                empty={t('common.none')}
              />
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('dashboard.potentialSaving')}</h2>
        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          }}
        >
          <SavingsBlock label={t('report.savingsThisWeek')} rollup={rollup.week} locale={locale} t={t} />
          <SavingsBlock label={t('report.savingsThisMonth')} rollup={rollup.month} locale={locale} t={t} />
          <SavingsBlock label={t('report.savingsThisYear')} rollup={rollup.year} locale={locale} t={t} />
        </div>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
          {t('report.savingsExplainer')}
        </p>
      </section>

      {recommended && (
        <section className="card">
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{t('report.recommendation')}</h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            {t('optimize.storeCount', { count: recommended.storeCount })} ·{' '}
            {formatAgorot(recommended.payableTotalAgorot, locale)}
            {recommended.legs.map((leg) => ` · ${leg.branch.chainName}`).join('')}
          </p>
          <Link href="/basket" style={{ display: 'inline-block', marginBlockStart: '0.75rem', color: 'var(--color-brand)', fontWeight: 600 }}>
            {t('nav.basket')} →
          </Link>
        </section>
      )}
    </div>
  );
}

function ContributorList({
  title,
  lines,
  locale,
  empty,
}: {
  title: string;
  lines: Array<{
    productId: string;
    displayName: string;
    previousTotalAgorot: number | null;
    currentTotalAgorot: number | null;
    unitPercentageChange: number | null;
  }>;
  locale: 'he' | 'en';
  empty: string;
}) {
  return (
    <div>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>{title}</h3>
      {lines.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
          {lines.map((line) => (
            <li key={line.productId} style={{ display: 'grid', gap: '0.15rem' }}>
              <Link href={`/product/${line.productId}`} style={{ color: 'inherit', fontWeight: 600 }}>
                {line.displayName}
              </Link>
              <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
                  {formatAgorot(line.previousTotalAgorot ?? 0, locale)} →{' '}
                  {formatAgorot(line.currentTotalAgorot ?? 0, locale)}
                </span>
                {line.unitPercentageChange !== null && (
                  <ChangePill
                    direction={line.unitPercentageChange > 0 ? 'increase' : 'decrease'}
                    percentage={line.unitPercentageChange}
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SavingsBlock({
  label,
  rollup,
  locale,
  t,
}: {
  label: string;
  rollup: { potentialAgorot: number; confirmedAgorot: number };
  locale: 'he' | 'en';
  t: ReturnType<typeof createTranslator>;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)', fontWeight: 600 }}>{label}</span>
      <span className="num" style={{ fontSize: '1.15rem', color: 'var(--color-brand)' }}>
        {formatAgorot(rollup.potentialAgorot, locale)}{' '}
        <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>{t('report.potential')}</span>
      </span>
      <span className="num" style={{ fontSize: '0.9rem' }}>
        {formatAgorot(rollup.confirmedAgorot, locale)}{' '}
        <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>{t('report.confirmed')}</span>
      </span>
    </div>
  );
}

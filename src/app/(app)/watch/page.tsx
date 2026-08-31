import Link from 'next/link';
import { PriceChangeView } from '@/components/PriceChange';
import { formatAgorot } from '@/lib/domain/money';
import { createTranslator, formatPercent } from '@/lib/i18n';
import { getDefaultBasket } from '@/lib/services/baskets';
import { aggregateMovement, basketWatch, groupMovements } from '@/lib/services/price-intelligence';
import { getPreferences } from '@/lib/services/users';
import { requireUser } from '@/lib/server/context';

const PERIODS = [
  { days: 1, key: 'watch.today' },
  { days: 7, key: 'watch.days7' },
  { days: 30, key: 'watch.days30' },
  { days: 90, key: 'watch.days90' },
] as const;

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);
  const params = await searchParams;
  const requested = Number(params.days);
  const days = PERIODS.some((p) => p.days === requested) ? requested : 7;

  const basket = getDefaultBasket(db, user.id);
  const preferences = getPreferences(db, user.id);
  const productIds = (basket?.items ?? [])
    .map((item) => item.productId)
    .filter((id): id is string => id !== null);

  const groups = groupMovements(
    basketWatch(db, productIds, { sinceDays: days, thresholds: preferences.severityThresholds }),
  );
  const byChain = aggregateMovement(db, 'chain', { sinceDays: days });
  const byCategory = aggregateMovement(db, 'category', { sinceDays: days });

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <header style={{ display: 'grid', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{t('watch.title')}</h1>
        <nav aria-label={t('watch.period')} className="scroll-x">
          <ul style={{ display: 'flex', gap: '0.4rem', listStyle: 'none', padding: 0, margin: 0 }}>
            {PERIODS.map((period) => (
              <li key={period.days}>
                <Link
                  href={`/watch?days=${period.days}`}
                  className="pill"
                  aria-current={period.days === days ? 'true' : undefined}
                  style={{
                    border: '1px solid var(--color-line)',
                    background: period.days === days ? 'var(--color-brand-soft)' : 'var(--color-surface)',
                    color: period.days === days ? 'var(--color-brand)' : 'var(--color-ink-soft)',
                    textDecoration: 'none',
                  }}
                >
                  {t(period.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <MovementList title={`🔴 ${t('watch.rising')}`} entries={groups.rising} locale={locale} empty={t('common.notEnoughData')} />
      <MovementList title={`🟢 ${t('watch.falling')}`} entries={groups.falling} locale={locale} empty={t('common.notEnoughData')} />

      {groups.unavailable.length > 0 && (
        <section className="card">
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{t('watch.unavailable')}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
            {groups.unavailable.map((entry) => (
              <li key={entry.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href={`/product/${entry.productId}`} style={{ color: 'inherit' }}>{entry.displayName}</Link>
                <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
                  {formatAgorot(entry.currentPriceAgorot, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        }}
      >
        <AggregateCard title={t('watch.byChain')} rows={byChain} emptyText={t('watch.notEnoughForAggregate')} />
        <AggregateCard title={t('watch.byCategory')} rows={byCategory} emptyText={t('watch.notEnoughForAggregate')} />
      </section>
    </div>
  );
}

function MovementList({
  title,
  entries,
  locale,
  empty,
}: {
  title: string;
  entries: ReturnType<typeof groupMovements>['rising'];
  locale: 'he' | 'en';
  empty: string;
}) {
  return (
    <section className="card">
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{title}</h2>
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
          {entries.map((entry) => (
            <li
              key={entry.productId}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}
            >
              <Link href={`/product/${entry.productId}`} style={{ color: 'inherit', fontWeight: 600 }}>
                {entry.displayName}
              </Link>
              <PriceChangeView change={entry.change} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AggregateCard({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: Array<{ key: string; label: string; percentageChange: number; productCount: number }>;
  emptyText: string;
}) {
  return (
    <div className="card">
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{title}</h2>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{emptyText}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
          {rows.map((row) => (
            <li key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
              <span>
                {row.label}{' '}
                <span style={{ color: 'var(--color-ink-soft)', fontSize: '0.8125rem' }} className="num">
                  ({row.productCount})
                </span>
              </span>
              <span
                className="num"
                style={{
                  color: row.percentageChange > 0 ? 'var(--color-rise)' : row.percentageChange < 0 ? 'var(--color-fall)' : 'var(--color-flat)',
                  fontWeight: 600,
                }}
              >
                {formatPercent(row.percentageChange)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

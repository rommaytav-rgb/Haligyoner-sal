import { notFound } from 'next/navigation';
import { ChangePill } from '@/components/PriceChange';
import { formatAgorot } from '@/lib/domain/money';
import { createTranslator, formatDate, formatPercent, formatShortDate, type TranslationKey } from '@/lib/i18n';
import { productIntelligence } from '@/lib/services/price-intelligence';
import { loadChainRegistry } from '@/lib/providers/chain-registry';
import { getPreferences } from '@/lib/services/users';
import { requireUser } from '@/lib/server/context';

const VERDICT_KEY: Record<string, TranslationKey> = {
  good_time_to_buy: 'product.goodTimeToBuy',
  about_normal: 'product.aboutNormal',
  consider_waiting: 'product.considerWaiting',
  not_enough_data: 'product.notEnoughHistory',
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);
  const { id } = await params;

  // "Your usual price" must mean the price at stores this user would actually
  // shop at, so the baseline is scoped to their preferred chains, or to every
  // chain they have not excluded.
  const preferences = getPreferences(db, user.id);
  const allChainIds = loadChainRegistry().chains.map((chain) => chain.id);
  const scopedChainIds =
    preferences.preferredChainIds.length > 0
      ? preferences.preferredChainIds
      : allChainIds.filter((chainId) => !preferences.excludedChainIds.includes(chainId));

  const intel = productIntelligence(db, id, { chainIds: scopedChainIds });
  if (!intel) notFound();

  const current = intel.currentBestPriceAgorot;
  const vsAverage = intel.comparisons.vsNinetyDayAveragePercent;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.3rem, 4vw, 1.7rem)' }}>{intel.displayName}</h1>
        {intel.currentObservedAt && (
          <p style={{ margin: '0.35rem 0 0', color: 'var(--color-ink-soft)', fontSize: '0.875rem' }}>
            {t('common.observedAt')} {formatDate(intel.currentObservedAt, locale)}
          </p>
        )}
      </header>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('product.title')}</h2>
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gap: '0.6rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
          }}
        >
          <Row label={t('product.current')} value={current === null ? t('common.unavailable') : formatAgorot(current, locale)} />
          <Row
            label={t('product.days7Ago')}
            value={
              intel.comparisons.sevenDays
                ? formatAgorot(intel.comparisons.sevenDays.priceAgorot, locale)
                : t('common.notEnoughData')
            }
          />
          <Row
            label={t('product.days30Ago')}
            value={
              intel.comparisons.thirtyDays
                ? formatAgorot(intel.comparisons.thirtyDays.priceAgorot, locale)
                : t('common.notEnoughData')
            }
          />
          <Row
            label={t('product.average90')}
            value={
              intel.comparisons.ninetyDayAverage
                ? formatAgorot(intel.comparisons.ninetyDayAverage.averageAgorot, locale)
                : t('common.notEnoughData')
            }
          />
        </dl>

        {/* Only stated when there is a real 90-day window behind it. */}
        {vsAverage !== null && intel.comparisons.ninetyDayAverage?.coversFullWindow && (
          <p style={{ marginBlock: '0.75rem 0' }}>
            <ChangePill direction={vsAverage > 0 ? 'increase' : vsAverage < 0 ? 'decrease' : 'unchanged'} percentage={vsAverage} />{' '}
            {t('product.vsAverage', {
              percent: `${formatPercent(vsAverage)} ${vsAverage > 0 ? t('product.above') : t('product.below')}`,
            })}
          </p>
        )}
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('product.shouldIBuy')}</h2>
        {!intel.advice || intel.advice.verdict === 'not_enough_data' ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('product.notEnoughHistory')}</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <strong
              style={{
                fontSize: '1.1rem',
                color:
                  intel.advice.verdict === 'good_time_to_buy'
                    ? 'var(--color-fall)'
                    : intel.advice.verdict === 'consider_waiting'
                      ? 'var(--color-rise)'
                      : 'var(--color-ink)',
              }}
            >
              {t(VERDICT_KEY[intel.advice.verdict] ?? 'product.aboutNormal')}
            </strong>
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gap: '0.5rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
              }}
            >
              <Row
                label={t('product.yourUsualPrice')}
                value={
                  intel.baseline.usualPriceAgorot === null
                    ? t('common.notEnoughData')
                    : formatAgorot(intel.baseline.usualPriceAgorot, locale)
                }
              />
              <Row
                label={t('product.yourAverage')}
                value={
                  intel.baseline.averagePriceAgorot === null
                    ? t('common.notEnoughData')
                    : formatAgorot(intel.baseline.averagePriceAgorot, locale)
                }
              />
              <Row
                label={t('product.lowestObserved')}
                value={
                  intel.baseline.lowestObservedAgorot === null
                    ? t('common.notEnoughData')
                    : formatAgorot(intel.baseline.lowestObservedAgorot, locale)
                }
              />
              <Row
                label={t('product.highestObserved')}
                value={
                  intel.baseline.highestObservedAgorot === null
                    ? t('common.notEnoughData')
                    : formatAgorot(intel.baseline.highestObservedAgorot, locale)
                }
              />
            </dl>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
              {t('product.noPrediction')}
            </p>
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('product.timeline')}</h2>
        {intel.timeline.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('common.notEnoughData')}</p>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.35rem' }}>
            {intel.timeline.slice(-16).map((point) => {
              const pct = point.percentageChange;
              return (
                <li
                  key={`${point.chainId}-${point.observedAt}`}
                  style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <span style={{ minWidth: '5.5rem', color: 'var(--color-ink-soft)', fontSize: '0.85rem' }}>
                    {formatShortDate(point.observedAt, locale)}
                  </span>
                  <span className="num" style={{ minWidth: '4.5rem', fontWeight: 600 }}>
                    {formatAgorot(point.priceAgorot, locale)}
                  </span>
                  {pct !== null && pct !== 0 && (
                    <ChangePill direction={pct > 0 ? 'increase' : 'decrease'} percentage={pct} />
                  )}
                  {point.isPromotional && (
                    <span className="pill" style={{ background: 'var(--color-fall-soft)', color: 'var(--color-fall)' }}>
                      {t('change.promotionStarted')}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }} className="num">
          {intel.observationCount} · {t('common.source')}
          {intel.currentBestChainId ? ` · ${intel.currentBestChainId}` : ''}
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>{label}</dt>
      <dd className="num" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
        {value}
      </dd>
    </div>
  );
}

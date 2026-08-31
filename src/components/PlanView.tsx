/**
 * Renders a shopping plan: what to buy where, what it costs, which promotions
 * were applied, which were not and why, and every substitution made.
 */

import { formatAgorot } from '@/lib/domain/money';
import type { ShoppingPlan } from '@/lib/domain/optimizer';
import type { PromotionIneligibility } from '@/lib/domain/promotions';
import { createTranslator, formatDate, type Locale, type TranslationKey } from '@/lib/i18n';

const INELIGIBILITY_KEY: Record<PromotionIneligibility, TranslationKey> = {
  requires_membership: 'optimize.reasonRequiresMembership',
  below_min_quantity: 'optimize.reasonBelowMinQuantity',
  expired: 'optimize.reasonExpired',
  not_started: 'optimize.reasonNotStarted',
  incomplete_promotion_data: 'optimize.reasonIncompleteData',
};

export function PlanView({ plan, locale }: { plan: ShoppingPlan; locale: Locale }) {
  const t = createTranslator(locale);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gap: '0.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
        }}
      >
        <Figure label={t('optimize.goodsTotal')} value={formatAgorot(plan.goodsTotalAgorot, locale)} />
        {plan.deliveryTotalAgorot > 0 && (
          <Figure label={t('optimize.delivery')} value={formatAgorot(plan.deliveryTotalAgorot, locale)} />
        )}
        {plan.travelCostAgorot > 0 && (
          <Figure
            label={t('optimize.travelEstimate')}
            value={formatAgorot(Math.round(plan.travelCostAgorot), locale)}
            muted
          />
        )}
        <Figure label={t('optimize.payableTotal')} value={formatAgorot(plan.payableTotalAgorot, locale)} strong />
      </div>

      {plan.legs.map((leg) => (
        <section key={leg.branch.branchId} className="card" style={{ padding: '0.85rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <strong>{leg.branch.chainName}</strong>{' '}
              <span style={{ color: 'var(--color-ink-soft)' }}>{leg.branch.branchName}</span>
              {leg.branch.distanceKm !== null && (
                <span className="num" style={{ color: 'var(--color-ink-soft)', marginInlineStart: '0.5rem' }}>
                  {leg.branch.distanceKm} km
                </span>
              )}
            </div>
            <strong className="num">{formatAgorot(leg.subtotalAgorot, locale)}</strong>
          </header>

          {leg.belowDeliveryMinimum && (
            <p style={{ margin: '0.5rem 0 0', color: 'var(--color-warn)', fontSize: '0.875rem' }}>
              {t('optimize.belowDeliveryMinimum')}
            </p>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: '0.6rem 0 0', display: 'grid', gap: '0.4rem' }}>
            {leg.lines.map((line) => (
              <li key={line.lineId} style={{ display: 'grid', gap: '0.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ overflowWrap: 'anywhere' }}>
                    {line.displayName}
                    {line.quantity !== 1 && <span className="num"> × {line.quantity}</span>}
                  </span>
                  <span className="num">{formatAgorot(line.pricing.effectiveTotalAgorot, locale)}</span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                  {line.isSubstitute && (
                    <span className="pill" style={{ background: 'var(--color-warn-soft)', color: 'var(--color-warn)' }}>
                      ⇄ {t('optimize.substitutionNotice', { original: line.requestedProductId })}
                    </span>
                  )}
                  {line.pricing.appliedPromotionId && (
                    <span className="pill" style={{ background: 'var(--color-fall-soft)', color: 'var(--color-fall)' }}>
                      {t('optimize.promotionApplied')}: {line.pricing.appliedPromotionDescription}
                    </span>
                  )}
                  {line.pricing.unappliedPromotions.map((unapplied) => (
                    <span
                      key={unapplied.promotionId}
                      className="pill"
                      style={{ background: 'var(--color-surface-muted)', color: 'var(--color-flat)' }}
                      title={unapplied.description}
                    >
                      {t('optimize.promotionNotApplied')}: {t(INELIGIBILITY_KEY[unapplied.reason])}
                    </span>
                  ))}
                  {/* Every price is traceable to where and when it was verified. */}
                  <span style={{ color: 'var(--color-ink-soft)' }}>
                    {t('common.observedAt')} {formatDate(line.observedAt, locale)} · {t('common.source')}:{' '}
                    {line.source}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.unpricedLineIds.length > 0 && (
        <p style={{ margin: 0, color: 'var(--color-warn)', fontSize: '0.875rem' }}>
          {t('dashboard.coverageGapBody', { count: plan.unpricedLineIds.length })}
        </p>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.1rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>{label}</span>
      <span
        className="num"
        style={{
          fontSize: strong ? '1.3rem' : '1.05rem',
          fontWeight: strong ? 700 : 500,
          color: muted ? 'var(--color-ink-soft)' : 'var(--color-ink)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

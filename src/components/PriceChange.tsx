/**
 * Price movement indicators.
 *
 * A single place decides how a rise, a fall and an unchanged price look, so the
 * meaning of a colour is consistent everywhere in the product.
 */

import { formatAgorot } from '@/lib/domain/money';
import type { PriceChange, PriceSeverity } from '@/lib/domain/price-change';
import { formatDate, formatPercent, translate, type Locale } from '@/lib/i18n';

const DIRECTION_STYLE = {
  increase: { background: 'var(--color-rise-soft)', color: 'var(--color-rise)' },
  decrease: { background: 'var(--color-fall-soft)', color: 'var(--color-fall)' },
  unchanged: { background: 'var(--color-surface-muted)', color: 'var(--color-flat)' },
} as const;

const DIRECTION_MARK = { increase: '🔴', decrease: '🟢', unchanged: '⚪' } as const;

export function ChangePill({
  direction,
  percentage,
  severity,
}: {
  direction: 'increase' | 'decrease' | 'unchanged';
  percentage: number;
  severity?: PriceSeverity;
}) {
  const style = DIRECTION_STYLE[direction];
  return (
    <span className="pill" style={style} data-severity={severity} data-direction={direction}>
      <span aria-hidden="true">{DIRECTION_MARK[direction]}</span>
      <span className="num">{formatPercent(percentage)}</span>
    </span>
  );
}

export function PriceTransition({
  fromAgorot,
  toAgorot,
  locale,
}: {
  fromAgorot: number;
  toAgorot: number;
  locale: Locale;
}) {
  return (
    <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
      {formatAgorot(fromAgorot, locale)} → {formatAgorot(toAgorot, locale)}
    </span>
  );
}

/**
 * Renders a price change, including the cases where there is nothing honest to
 * say: no earlier observation, a package-size change, or a comparison so old
 * that calling it "today's change" would be wrong.
 */
export function PriceChangeView({
  change,
  locale,
  compact = false,
}: {
  change: PriceChange;
  locale: Locale;
  compact?: boolean;
}) {
  if (!change.comparable) {
    if (change.reason === 'package_size_changed') {
      return <span style={{ color: 'var(--color-warn)' }}>{translate(locale, 'watch.packageChanged')}</span>;
    }
    return (
      <span style={{ color: 'var(--color-ink-soft)' }}>{translate(locale, 'watch.noPreviousObservation')}</span>
    );
  }

  const pill = (
    <ChangePill
      direction={change.direction}
      percentage={change.percentageChange}
      severity={change.severity}
    />
  );

  if (compact) return pill;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {pill}
      <PriceTransition
        fromAgorot={change.previousPriceAgorot}
        toAgorot={change.currentPriceAgorot}
        locale={locale}
      />
      {!change.isRecentComparison && (
        <span style={{ color: 'var(--color-ink-soft)', fontSize: '0.8125rem' }}>
          {translate(locale, 'watch.staleComparison', {
            current: formatAgorot(change.currentPriceAgorot, locale),
            previous: formatAgorot(change.previousPriceAgorot, locale),
            date: formatDate(change.previousObservedAt, locale),
          })}
        </span>
      )}
      {change.promotionTransition === 'promotion_started' && (
        <span className="pill" style={DIRECTION_STYLE.decrease}>
          {translate(locale, 'change.promotionStarted')}
        </span>
      )}
      {change.promotionTransition === 'promotion_ended' && (
        <span className="pill" style={DIRECTION_STYLE.increase}>
          {translate(locale, 'change.promotionEnded')}
        </span>
      )}
      {change.membershipTransition === 'member_price_started' && (
        <span className="pill" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
          {translate(locale, 'change.memberPriceStarted')}
        </span>
      )}
    </span>
  );
}

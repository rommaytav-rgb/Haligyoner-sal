/**
 * Side-by-side comparison of the shopping strategies.
 *
 * Shows the raw payable total for each option and, separately, the modelled
 * travel cost — so a cheaper basket that costs more to reach is visibly so
 * rather than silently preferred.
 */

import { formatAgorot } from '@/lib/domain/money';
import type { OptimizationOutcome, ShoppingPlan } from '@/lib/domain/optimizer';
import { createTranslator, type Locale, type TranslationKey } from '@/lib/i18n';

export function ModeComparison({ outcome, locale }: { outcome: OptimizationOutcome; locale: Locale }) {
  const t = createTranslator(locale);

  const rows: Array<{ key: TranslationKey; plan: ShoppingPlan | null; icon: string }> = [
    { key: 'optimize.modeCheapest', plan: outcome.cheapest, icon: '💰' },
    { key: 'optimize.modeBestValue', plan: outcome.bestValue, icon: '⚖️' },
    { key: 'optimize.modeConvenient', plan: outcome.mostConvenient, icon: '⚡' },
    { key: 'optimize.modeClosest', plan: outcome.closest, icon: '🚗' },
    { key: 'optimize.modeOneStore', plan: outcome.oneStore, icon: '🛒' },
  ];

  return (
    <div className="scroll-x">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
        <thead>
          <tr style={{ textAlign: 'start' }}>
            <th style={cellStyle}>{t('optimize.mode')}</th>
            <th style={cellStyle}>{t('optimize.payableTotal')}</th>
            <th style={cellStyle}>{t('optimize.stores')}</th>
            <th style={cellStyle}>{t('optimize.travelEstimate')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBlockStart: '1px solid var(--color-line)' }}>
              <td style={cellStyle}>
                <span aria-hidden="true">{row.icon}</span> {t(row.key)}
              </td>
              <td style={cellStyle}>
                {row.plan ? (
                  <strong className="num">{formatAgorot(row.plan.payableTotalAgorot, locale)}</strong>
                ) : (
                  <span style={{ color: 'var(--color-ink-soft)' }}>{t('common.unavailable')}</span>
                )}
              </td>
              <td style={cellStyle} className="num">
                {row.plan?.storeCount ?? '—'}
              </td>
              <td style={cellStyle} className="num">
                {row.plan ? formatAgorot(Math.round(row.plan.travelCostAgorot), locale) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem',
  textAlign: 'start',
  fontSize: '0.9rem',
  verticalAlign: 'top',
};

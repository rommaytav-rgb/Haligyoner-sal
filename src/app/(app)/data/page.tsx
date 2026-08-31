import { createTranslator, formatDate, type TranslationKey } from '@/lib/i18n';
import { loadChainRegistry } from '@/lib/providers/chain-registry';
import { listProviderStatus } from '@/lib/services/catalog';
import { getDataStatus } from '@/lib/services/data-status';
import { requireUser } from '@/lib/server/context';

const DATA_KIND_LABEL: Record<string, TranslationKey> = {
  official_government_transparency: 'data.dataKindGov',
  retailer_api: 'data.dataKindRetailer',
  licensed_commercial_api: 'data.dataKindLicensed',
  authorized_feed: 'data.dataKindFeed',
  demo_fixture: 'data.dataKindDemo',
};

export default async function DataPage() {
  const { db, locale } = await requireUser();
  const t = createTranslator(locale);
  const status = getDataStatus(db);
  const providers = listProviderStatus(db);
  const registry = loadChainRegistry();

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{t('data.title')}</h1>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('data.providers')}</h2>
        {providers.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('common.notEnoughData')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
            {providers.map((provider) => (
              <li
                key={provider.providerId}
                style={{ display: 'grid', gap: '0.2rem', paddingBlockEnd: '0.6rem', borderBlockEnd: '1px solid var(--color-line)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <strong>{provider.name}</strong>
                  <span
                    className="pill"
                    style={
                      provider.available
                        ? { background: 'var(--color-fall-soft)', color: 'var(--color-fall)' }
                        : { background: 'var(--color-surface-muted)', color: 'var(--color-flat)' }
                    }
                  >
                    {t(provider.available ? 'data.available' : 'data.unavailable')}
                  </span>
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
                  {t(DATA_KIND_LABEL[provider.dataKind] ?? 'data.dataKindFeed')}
                  {' · '}
                  {t('data.lastSuccess')}:{' '}
                  {provider.lastSuccessAt ? formatDate(provider.lastSuccessAt, locale) : t('common.none')}
                </span>
                {provider.lastError && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-warn)' }} dir="ltr">
                    {t('data.lastError')}: {provider.lastError}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('data.chainsCovered')}</h2>
        <p className="num" style={{ margin: '0 0 0.75rem', color: 'var(--color-ink-soft)', fontSize: '0.875rem' }}>
          {status.coveredChains.length} / {status.registeredChainCount} · {status.totalProducts} ·{' '}
          {status.totalPriceObservations}
        </p>
        {status.coveredChains.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('common.notEnoughData')}</p>
        ) : (
          <div className="scroll-x">
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
              <thead>
                <tr>
                  <th style={cell}>{t('data.chainsCovered')}</th>
                  <th style={cell}>{t('optimize.stores')}</th>
                  <th style={cell}>{t('common.observedAt')}</th>
                  <th style={cell}>{t('data.status')}</th>
                </tr>
              </thead>
              <tbody>
                {status.coveredChains.map((chain) => (
                  <tr key={chain.chainId} style={{ borderBlockStart: '1px solid var(--color-line)' }}>
                    <td style={cell}>{locale === 'he' ? chain.nameHe : chain.nameEn}</td>
                    <td style={cell} className="num">{chain.branchCount}</td>
                    <td style={cell}>
                      {chain.newestObservationAt ? formatDate(chain.newestObservationAt, locale) : '—'}
                    </td>
                    <td style={cell}>
                      <span
                        className="pill"
                        style={
                          chain.realMarketData
                            ? { background: 'var(--color-fall-soft)', color: 'var(--color-fall)' }
                            : { background: 'var(--color-warn-soft)', color: 'var(--color-warn)' }
                        }
                      >
                        {t(chain.realMarketData ? 'data.available' : 'data.dataKindDemo')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>{t('data.registryTitle')}</h2>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--color-ink-soft)', fontSize: '0.875rem', lineHeight: 1.6 }}>
          {t('data.registryBody')}
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: '0.35rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          }}
        >
          {registry.chains.map((chain) => (
            <li key={chain.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span>{locale === 'he' ? chain.nameHe : chain.nameEn}</span>
              <span
                className="pill"
                style={
                  chain.endpointVerified
                    ? { background: 'var(--color-fall-soft)', color: 'var(--color-fall)' }
                    : { background: 'var(--color-surface-muted)', color: 'var(--color-flat)' }
                }
              >
                {t(chain.endpointVerified ? 'data.verified' : 'data.unverified')}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const cell: React.CSSProperties = { padding: '0.45rem 0.6rem', textAlign: 'start', fontSize: '0.875rem' };

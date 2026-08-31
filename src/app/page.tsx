import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { ChangePill } from '@/components/PriceChange';
import { formatAgorot } from '@/lib/domain/money';
import { percentageChange } from '@/lib/domain/price-change';
import { createTranslator } from '@/lib/i18n';
import { getContext } from '@/lib/server/context';

/**
 * The example on this page is a worked illustration, not market data: the
 * amounts are the ones from the product brief and the percentages beneath them
 * are computed by the same engine the app uses, so nothing here is hand-written
 * arithmetic.
 */
const EXAMPLE = {
  usualAgorot: 61_200,
  optimizedAgorot: 53_400,
  coffeeFromAgorot: 3_100,
  coffeeToAgorot: 2_300,
};

export default async function LandingPage() {
  const { user, locale } = await getContext();
  if (user) redirect('/dashboard');
  const t = createTranslator(locale);

  const savingAgorot = EXAMPLE.usualAgorot - EXAMPLE.optimizedAgorot;
  const coffeeChange = percentageChange(EXAMPLE.coffeeFromAgorot, EXAMPLE.coffeeToAgorot) ?? 0;

  return (
    <main id="main">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem clamp(1rem, 5vw, 3rem)',
          maxWidth: 1120,
          marginInline: 'auto',
        }}
      >
        <strong style={{ fontSize: '1.05rem' }}>{t('common.appName')}</strong>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <LocaleSwitcher locale={locale} />
          <Link href="/sign-in" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
            {t('auth.signIn')}
          </Link>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1120,
          marginInline: 'auto',
          padding: 'clamp(1.5rem, 5vw, 3.5rem) clamp(1rem, 5vw, 3rem)',
          display: 'grid',
          gap: 'clamp(1.5rem, 4vw, 3rem)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.25rem)', lineHeight: 1.1, margin: 0, letterSpacing: '-0.02em' }}>
            {t('landing.headline')}
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2.4vw, 1.2rem)',
              color: 'var(--color-ink-soft)',
              lineHeight: 1.6,
              marginBlock: '1rem 1.75rem',
              maxWidth: '46ch',
            }}
          >
            {t('landing.subheadline')}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/sign-up" className="btn btn-primary">
              {t('landing.ctaPrimary')}
            </Link>
            <Link href="/sign-in" className="btn btn-secondary">
              {t('landing.ctaSecondary')}
            </Link>
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-ink-soft)' }}>{t('landing.exampleTitle')}</h2>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <ExampleRow label={t('landing.exampleUsual')} value={formatAgorot(EXAMPLE.usualAgorot, locale)} />
            <div aria-hidden="true" style={{ textAlign: 'center', color: 'var(--color-ink-soft)' }}>↓</div>
            <ExampleRow
              label={t('landing.exampleOptimized')}
              value={formatAgorot(EXAMPLE.optimizedAgorot, locale)}
              emphasis
            />
            <div aria-hidden="true" style={{ textAlign: 'center', color: 'var(--color-ink-soft)' }}>↓</div>
            <ExampleRow
              label={`💰 ${t('landing.exampleSaving')}`}
              value={formatAgorot(savingAgorot, locale)}
              emphasis
            />
          </div>

          <div style={{ borderBlockStart: '1px solid var(--color-line)', paddingBlockStart: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--color-ink-soft)' }}>
              {t('landing.priceChangeExample')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span>☕</span>
              <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
                {formatAgorot(EXAMPLE.coffeeFromAgorot, locale)} → {formatAgorot(EXAMPLE.coffeeToAgorot, locale)}
              </span>
              <ChangePill direction="decrease" percentage={coffeeChange} />
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: 1120,
          marginInline: 'auto',
          padding: '0 clamp(1rem, 5vw, 3rem) 3rem',
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
        }}
      >
        <Feature title={t('landing.feature1Title')} body={t('landing.feature1Body')} />
        <Feature title={t('landing.feature2Title')} body={t('landing.feature2Body')} />
        <Feature title={t('landing.feature3Title')} body={t('landing.feature3Body')} />
      </section>

      <section
        style={{
          maxWidth: 1120,
          marginInline: 'auto',
          padding: '0 clamp(1rem, 5vw, 3rem) 4rem',
        }}
      >
        <div className="card" style={{ background: 'var(--color-brand-soft)', borderColor: '#bfe3d7' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: 'var(--color-brand)' }}>
            {t('landing.honestyTitle')}
          </h2>
          <p style={{ margin: 0, color: 'var(--color-ink)', lineHeight: 1.6 }}>{t('landing.honestyBody')}</p>
        </div>
      </section>
    </main>
  );
}

function ExampleRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '1rem',
        padding: '0.6rem 0.8rem',
        borderRadius: 10,
        background: emphasis ? 'var(--color-brand-soft)' : 'var(--color-surface-muted)',
      }}
    >
      <span style={{ color: 'var(--color-ink-soft)', fontSize: '0.9rem' }}>{label}</span>
      <strong
        className="num"
        style={{ fontSize: '1.25rem', color: emphasis ? 'var(--color-brand)' : 'var(--color-ink)' }}
      >
        {value}
      </strong>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem' }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--color-ink-soft)', lineHeight: 1.6, fontSize: '0.9375rem' }}>{body}</p>
    </div>
  );
}

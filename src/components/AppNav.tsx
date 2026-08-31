'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { createTranslator, type Locale, type TranslationKey } from '@/lib/i18n';

const LINKS: Array<{ href: string; key: TranslationKey; icon: string }> = [
  { href: '/dashboard', key: 'nav.dashboard', icon: '🏠' },
  { href: '/basket', key: 'nav.basket', icon: '🛒' },
  { href: '/watch', key: 'nav.priceWatch', icon: '📊' },
  { href: '/report', key: 'nav.report', icon: '📋' },
  { href: '/alerts', key: 'nav.alerts', icon: '🔔' },
  { href: '/receipts', key: 'nav.receipts', icon: '🧾' },
  { href: '/settings', key: 'nav.settings', icon: '⚙️' },
];

export function AppNav({ locale, email }: { locale: Locale; email: string }) {
  const t = createTranslator(locale);
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const signOut = () => {
    startTransition(async () => {
      await fetch('/api/auth/sign-out', { method: 'POST' });
      router.push('/');
      router.refresh();
    });
  };

  return (
    <header
      style={{
        background: 'var(--color-surface)',
        borderBlockEnd: '1px solid var(--color-line)',
        position: 'sticky',
        insetBlockStart: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          marginInline: 'auto',
          padding: '0.6rem clamp(0.75rem, 3vw, 1.5rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <Link href="/dashboard" style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>
          {t('common.appName')}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <LocaleSwitcher locale={locale} />
          <span
            style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}
            className="hidden sm:inline"
            dir="ltr"
          >
            {email}
          </span>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem' }} onClick={signOut} disabled={pending}>
            {t('nav.signOut')}
          </button>
        </div>
      </div>

      <nav aria-label={t('common.appName')} className="scroll-x" style={{ borderBlockStart: '1px solid var(--color-line)' }}>
        <ul
          style={{
            maxWidth: 1120,
            marginInline: 'auto',
            padding: '0 clamp(0.75rem, 3vw, 1.5rem)',
            display: 'flex',
            gap: '0.25rem',
            listStyle: 'none',
            margin: 0,
          }}
        >
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.6rem 0.7rem',
                    fontSize: '0.9rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--color-brand)' : 'var(--color-ink-soft)',
                    borderBlockEnd: `2px solid ${active ? 'var(--color-brand)' : 'transparent'}`,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span aria-hidden="true">{link.icon}</span>
                  {t(link.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

import Link from 'next/link';
import { PrivacyPanel } from '@/components/PrivacyPanel';
import { SettingsForm } from '@/components/SettingsForm';
import { createTranslator } from '@/lib/i18n';
import { loadChainRegistry } from '@/lib/providers/chain-registry';
import { getPreferences, listMemberships } from '@/lib/services/users';
import { requireUser } from '@/lib/server/context';

export default async function SettingsPage() {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);
  const preferences = getPreferences(db, user.id);
  const memberships = listMemberships(db, user.id);
  const chains = loadChainRegistry().chains.map((chain) => ({
    id: chain.id,
    name: locale === 'he' ? chain.nameHe : chain.nameEn,
  }));

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{t('settings.title')}</h1>
        <Link href="/data" style={{ color: 'var(--color-brand)', fontWeight: 600 }}>
          {t('nav.data')} →
        </Link>
      </header>

      <SettingsForm preferences={preferences} chains={chains} memberships={memberships} locale={locale} />
      <PrivacyPanel locale={locale} />
    </div>
  );
}

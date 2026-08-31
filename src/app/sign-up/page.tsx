import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { createTranslator } from '@/lib/i18n';
import { getContext } from '@/lib/server/context';

export default async function SignUpPage() {
  const { user, locale } = await getContext();
  if (user) redirect('/dashboard');
  const t = createTranslator(locale);

  return (
    <main id="main" style={{ maxWidth: 420, marginInline: 'auto', padding: '3rem 1rem' }}>
      <h1 style={{ fontSize: '1.6rem', marginBlockEnd: '1.25rem' }}>{t('auth.signUp')}</h1>
      <div className="card">
        <AuthForm mode="sign-up" locale={locale} />
      </div>
      <p style={{ marginBlockStart: '1rem', color: 'var(--color-ink-soft)', fontSize: '0.9rem' }}>
        {t('auth.haveAccount')}{' '}
        <Link href="/sign-in" style={{ color: 'var(--color-brand)', fontWeight: 600 }}>
          {t('auth.signIn')}
        </Link>
      </p>
    </main>
  );
}

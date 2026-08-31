'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createTranslator, type Locale, type TranslationKey } from '@/lib/i18n';

const ERROR_KEYS: Record<string, TranslationKey> = {
  invalid_credentials: 'auth.invalidCredentials',
  email_in_use: 'auth.emailInUse',
  invalid_email: 'auth.invalidEmail',
  weak_password: 'auth.weakPassword',
};

export function AuthForm({ mode, locale }: { mode: 'sign-in' | 'sign-up'; locale: Locale }) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          mode === 'sign-up' ? { email, password, displayName: displayName || undefined, locale } : { email, password },
        ),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'common.error');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('common.error');
    } finally {
      setPending(false);
    }
  }

  const errorKey = error ? (ERROR_KEYS[error] ?? 'common.error') : null;

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '0.9rem' }}>
      {mode === 'sign-up' && (
        <div>
          <label className="label" htmlFor="displayName">
            {t('auth.displayName')}
          </label>
          <input
            id="displayName"
            className="field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          {t('auth.email')}
        </label>
        <input
          id="email"
          className="field"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          dir="ltr"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t('auth.password')}
        </label>
        <input
          id="password"
          className="field"
          type="password"
          required
          minLength={mode === 'sign-up' ? 10 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          dir="ltr"
        />
        {mode === 'sign-up' && (
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
            {t('auth.passwordHint')}
          </p>
        )}
      </div>

      {errorKey && (
        <p role="alert" style={{ margin: 0, color: 'var(--color-rise)', fontSize: '0.9rem' }}>
          {t(errorKey)}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t('common.loading') : t(mode === 'sign-up' ? 'auth.signUp' : 'auth.signIn')}
      </button>
    </form>
  );
}

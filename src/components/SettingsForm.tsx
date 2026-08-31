'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { OptimizationMode } from '@/lib/domain/optimizer';
import { agorotToShekels, shekelsToAgorot } from '@/lib/domain/money';
import type { UserPreferences } from '@/lib/services/users';
import { createTranslator, type Locale, type TranslationKey } from '@/lib/i18n';

const MODE_LABEL: Record<OptimizationMode, TranslationKey> = {
  cheapest: 'optimize.modeCheapest',
  best_value: 'optimize.modeBestValue',
  most_convenient: 'optimize.modeConvenient',
  closest: 'optimize.modeClosest',
  one_store: 'optimize.modeOneStore',
};

export function SettingsForm({
  preferences,
  chains,
  memberships,
  locale,
}: {
  preferences: UserPreferences;
  chains: Array<{ id: string; name: string }>;
  memberships: string[];
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const router = useRouter();
  const [form, setForm] = useState({
    optimizationMode: preferences.optimizationMode,
    maxStores: preferences.maxStores,
    maxDistanceKm: preferences.maxDistanceKm ?? '',
    city: preferences.city ?? '',
    homeLatitude: preferences.homeLatitude ?? '',
    homeLongitude: preferences.homeLongitude ?? '',
    householdSize: preferences.householdSize ?? '',
    weeklyBudget: preferences.weeklyBudgetAgorot === null ? '' : agorotToShekels(preferences.weeklyBudgetAgorot),
    wantsDelivery: preferences.wantsDelivery,
    allowSubstitutions: preferences.allowSubstitutions,
    excludedChainIds: preferences.excludedChainIds,
  });
  const [activeMemberships, setActiveMemberships] = useState<string[]>(memberships);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const asNumber = (value: string | number): number | null => {
    if (value === '' || value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus('saving');
    try {
      const budget = asNumber(form.weeklyBudget);
      const response = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          optimizationMode: form.optimizationMode,
          maxStores: Number(form.maxStores),
          maxDistanceKm: asNumber(form.maxDistanceKm),
          city: form.city || null,
          homeLatitude: asNumber(form.homeLatitude),
          homeLongitude: asNumber(form.homeLongitude),
          householdSize: asNumber(form.householdSize),
          weeklyBudgetAgorot: budget === null ? null : shekelsToAgorot(budget),
          wantsDelivery: form.wantsDelivery,
          allowSubstitutions: form.allowSubstitutions,
          excludedChainIds: form.excludedChainIds,
        }),
      });
      setStatus(response.ok ? 'saved' : 'error');
      if (response.ok) router.refresh();
    } catch {
      setStatus('error');
    }
  }

  async function toggleMembership(chainId: string, active: boolean) {
    setActiveMemberships((current) => (active ? [...current, chainId] : current.filter((id) => id !== chainId)));
    await fetch('/api/memberships', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chainId, active }),
    });
    router.refresh();
  }

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: '1.25rem' }}>
      <section className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{t('settings.preferences')}</h2>

        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
          <div>
            <label className="label" htmlFor="mode">{t('settings.mode')}</label>
            <select
              id="mode"
              className="field"
              value={form.optimizationMode}
              onChange={(e) => setForm({ ...form, optimizationMode: e.target.value as OptimizationMode })}
            >
              {(Object.keys(MODE_LABEL) as OptimizationMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {t(MODE_LABEL[mode])}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="maxStores">{t('settings.maxStores')}</label>
            <input
              id="maxStores"
              className="field"
              type="number"
              min={1}
              max={4}
              value={form.maxStores}
              onChange={(e) => setForm({ ...form, maxStores: Number(e.target.value) })}
              dir="ltr"
            />
          </div>

          <div>
            <label className="label" htmlFor="maxDistance">{t('settings.maxDistance')}</label>
            <input
              id="maxDistance"
              className="field"
              type="number"
              min={0}
              step="0.5"
              value={form.maxDistanceKm}
              onChange={(e) => setForm({ ...form, maxDistanceKm: e.target.value })}
              dir="ltr"
            />
          </div>

          <div>
            <label className="label" htmlFor="budget">{t('settings.budget')} (₪)</label>
            <input
              id="budget"
              className="field"
              type="number"
              min={0}
              step="1"
              value={form.weeklyBudget}
              onChange={(e) => setForm({ ...form, weeklyBudget: e.target.value })}
              dir="ltr"
            />
          </div>

          <div>
            <label className="label" htmlFor="city">{t('settings.city')}</label>
            <input id="city" className="field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>

          <div>
            <label className="label" htmlFor="household">{t('settings.householdSize')}</label>
            <input
              id="household"
              className="field"
              type="number"
              min={1}
              max={20}
              value={form.householdSize}
              onChange={(e) => setForm({ ...form, householdSize: e.target.value })}
              dir="ltr"
            />
          </div>

          <div>
            <label className="label" htmlFor="lat">{t('settings.latitude')}</label>
            <input
              id="lat"
              className="field"
              type="number"
              step="0.0001"
              value={form.homeLatitude}
              onChange={(e) => setForm({ ...form, homeLatitude: e.target.value })}
              dir="ltr"
            />
          </div>

          <div>
            <label className="label" htmlFor="lon">{t('settings.longitude')}</label>
            <input
              id="lon"
              className="field"
              type="number"
              step="0.0001"
              value={form.homeLongitude}
              onChange={(e) => setForm({ ...form, homeLongitude: e.target.value })}
              dir="ltr"
            />
          </div>
        </div>

        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={form.wantsDelivery}
            onChange={(e) => setForm({ ...form, wantsDelivery: e.target.checked })}
          />
          {t('settings.delivery')}
        </label>

        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={form.allowSubstitutions}
            onChange={(e) => setForm({ ...form, allowSubstitutions: e.target.checked })}
          />
          {t('settings.substitutions')}
        </label>
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('settings.excludedChains')}</h2>
        <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
          {chains.map((chain) => (
            <label key={chain.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.excludedChainIds.includes(chain.id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    excludedChainIds: e.target.checked
                      ? [...form.excludedChainIds, chain.id]
                      : form.excludedChainIds.filter((id) => id !== chain.id),
                  })
                }
              />
              {chain.name}
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>{t('settings.memberships')}</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
          {t('settings.membershipsHint')}
        </p>
        <div style={{ display: 'grid', gap: '0.4rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
          {chains.map((chain) => (
            <label key={chain.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={activeMemberships.includes(chain.id)}
                onChange={(e) => toggleMembership(chain.id, e.target.checked)}
              />
              {chain.name}
            </label>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
          {status === 'saving' ? t('common.loading') : t('common.save')}
        </button>
        {status === 'saved' && <span style={{ color: 'var(--color-fall)' }}>{t('settings.saved')}</span>}
        {status === 'error' && <span style={{ color: 'var(--color-rise)' }}>{t('common.error')}</span>}
      </div>
    </form>
  );
}

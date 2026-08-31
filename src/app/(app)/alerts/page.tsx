import { AlertsPanel } from '@/components/AlertsPanel';
import { formatAgorot } from '@/lib/domain/money';
import { createTranslator, formatDate, formatPercent } from '@/lib/i18n';
import { evaluateAlerts, listAlerts, recordNotifications } from '@/lib/services/alerts';
import { getDefaultBasket } from '@/lib/services/baskets';
import { listNotifications } from '@/lib/services/report';
import { requireUser } from '@/lib/server/context';

export default async function AlertsPage() {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);
  const basket = getDefaultBasket(db, user.id);
  const alerts = listAlerts(db, user.id);

  // Evaluating on load keeps the page honest: what is shown is what the rules
  // say about the data as it stands right now.
  if (alerts.length > 0) {
    const triggered = evaluateAlerts(db, user.id, basket ? [basket] : []);
    recordNotifications(db, user.id, triggered);
  }
  const notifications = listNotifications(db, user.id, 20);

  const products = (basket?.items ?? [])
    .filter((item) => item.productId !== null)
    .map((item) => ({ id: item.productId as string, name: item.displayName }));

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{t('alerts.title')}</h1>

      <AlertsPanel alerts={alerts} products={products} basketId={basket?.id ?? null} locale={locale} />

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('alerts.triggered')}</h2>
        {notifications.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('alerts.noneTriggered')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
            {notifications.map((notification) => {
              const facts = notification.facts as {
                displayName?: string;
                currentPriceAgorot?: number;
                previousPriceAgorot?: number;
                percentageChange?: number;
              };
              return (
                <li key={notification.id} style={{ display: 'grid', gap: '0.15rem' }}>
                  <strong>{facts.displayName ?? t('alerts.basket')}</strong>
                  <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {facts.previousPriceAgorot !== undefined && facts.currentPriceAgorot !== undefined && (
                      <span className="num" style={{ color: 'var(--color-ink-soft)' }}>
                        {formatAgorot(facts.previousPriceAgorot, locale)} →{' '}
                        {formatAgorot(facts.currentPriceAgorot, locale)}
                      </span>
                    )}
                    {facts.percentageChange !== undefined && (
                      <span
                        className="num"
                        style={{
                          fontWeight: 600,
                          color: facts.percentageChange > 0 ? 'var(--color-rise)' : 'var(--color-fall)',
                        }}
                      >
                        {formatPercent(facts.percentageChange)}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>
                      {formatDate(notification.createdAt, locale)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

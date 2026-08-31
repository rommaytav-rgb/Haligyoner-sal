import { ReceiptImport } from '@/components/ReceiptImport';
import { formatAgorot } from '@/lib/domain/money';
import { createTranslator, formatDate, type TranslationKey } from '@/lib/i18n';
import { listReceipts, suggestRecurringItems } from '@/lib/services/receipts';
import { requireUser } from '@/lib/server/context';

const STATUS_LABEL: Record<string, TranslationKey> = {
  extracted: 'receipts.statusExtracted',
  partial: 'receipts.statusPartial',
  failed: 'receipts.statusFailed',
  pending: 'receipts.statusPending',
};

export default async function ReceiptsPage() {
  const { db, user, locale } = await requireUser();
  const t = createTranslator(locale);
  const receipts = listReceipts(db, user.id);
  const recurring = suggestRecurringItems(db, user.id);

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.8rem)' }}>{t('receipts.title')}</h1>

      <section className="card">
        <ReceiptImport locale={locale} />
      </section>

      {recurring.length > 0 && (
        <section className="card">
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{t('receipts.recurringTitle')}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.4rem' }}>
            {recurring.map((item) => (
              <li key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span>{item.displayName}</span>
                <span style={{ color: 'var(--color-ink-soft)', fontSize: '0.875rem' }}>
                  {t('receipts.recurringBody', { count: item.receiptCount })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>{t('receipts.title')}</h2>
        {receipts.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{t('receipts.empty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  paddingBlockEnd: '0.6rem',
                  borderBlockEnd: '1px solid var(--color-line)',
                }}
              >
                <span>
                  <strong>
                    {receipt.purchasedAt ? formatDate(receipt.purchasedAt, locale) : formatDate(receipt.createdAt, locale)}
                  </strong>
                  <span style={{ color: 'var(--color-ink-soft)' }}>
                    {' · '}
                    {t('receipts.lines', { count: receipt.lineCount })} ·{' '}
                    {t('receipts.matched', { count: receipt.matchedLineCount })}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {receipt.totalAgorot !== null && (
                    <span className="num">{formatAgorot(receipt.totalAgorot, locale)}</span>
                  )}
                  <span
                    className="pill"
                    style={
                      receipt.status === 'failed'
                        ? { background: 'var(--color-rise-soft)', color: 'var(--color-rise)' }
                        : receipt.status === 'partial'
                          ? { background: 'var(--color-warn-soft)', color: 'var(--color-warn)' }
                          : { background: 'var(--color-fall-soft)', color: 'var(--color-fall)' }
                    }
                  >
                    {t(STATUS_LABEL[receipt.status] ?? 'receipts.statusPending')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Headline figure with a label and optional supporting note. */
export function StatCard({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  const color =
    tone === 'good' ? 'var(--color-fall)' : tone === 'bad' ? 'var(--color-rise)' : 'var(--color-ink)';
  return (
    <div className="card" style={{ display: 'grid', gap: '0.3rem', alignContent: 'start' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)', fontWeight: 600 }}>{label}</span>
      <strong className="num" style={{ fontSize: 'clamp(1.4rem, 4vw, 1.85rem)', color, lineHeight: 1.2 }}>
        {value}
      </strong>
      {note && <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-soft)' }}>{note}</span>}
    </div>
  );
}

import { AppNav } from '@/components/AppNav';
import { DemoDataBanner } from '@/components/DemoDataBanner';
import { getDataStatus } from '@/lib/services/data-status';
import { requireUser } from '@/lib/server/context';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, user, locale } = await requireUser();
  const status = getDataStatus(db);

  return (
    <div style={{ minHeight: '100vh' }}>
      <AppNav locale={locale} email={user.email} />
      {/* Whenever any price on screen could be synthetic, say so on every page. */}
      {status.usingDemoData && <DemoDataBanner locale={locale} />}
      <main
        id="main"
        style={{
          maxWidth: 1120,
          marginInline: 'auto',
          padding: 'clamp(1rem, 3vw, 2rem) clamp(0.75rem, 3vw, 1.5rem) 4rem',
        }}
      >
        {children}
      </main>
    </div>
  );
}

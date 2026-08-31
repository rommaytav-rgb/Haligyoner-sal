import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { listCases } from "@/server/services/cases";
import { unreadCount } from "@/server/services/notifications";
import { AppShell } from "@/components/nav/AppShell";
import { CaseCard } from "@/components/case/CaseCard";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { isOpen } from "@/domain/status";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/cases");

  const [cases, unread] = await Promise.all([listCases(user.id), unreadCount(user.id)]);
  const open = cases.filter((c) => isOpen(c.status));
  const settled = cases.filter((c) => !isOpen(c.status));

  return (
    <AppShell user={user} unread={unread}>
      <h1 className="display text-[28px] text-ink">My cases</h1>

      {cases.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white shadow-card">
          <EmptyState
            title="Nothing to fix yet."
            body="Hopefully it stays that way - but if something comes up, we're here."
            action={
              <Link href="/home">
                <Button size="lg">Tell us what&rsquo;s wrong</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Open ({open.length})
            </h2>
            {open.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-line bg-white px-5 py-6 text-[14px] text-ink-mute shadow-card">
                Nothing open right now.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {open.map((record) => (
                  <CaseCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </section>

          {settled.length > 0 && (
            <section className="mt-10">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                Closed &amp; resolved ({settled.length})
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {settled.map((record) => (
                  <CaseCard key={record.id} record={record} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

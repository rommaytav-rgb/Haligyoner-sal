import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { listCases } from "@/server/services/cases";
import { unreadCount } from "@/server/services/notifications";
import { AppShell } from "@/components/nav/AppShell";
import { CaseCard } from "@/components/case/CaseCard";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { getI18n } from "@/i18n/server";
import { isOpen } from "@/domain/status";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/cases");

  const [{ t }, cases, unread] = await Promise.all([getI18n(), listCases(user.id), unreadCount(user.id)]);
  const open = cases.filter((c) => isOpen(c.status));
  const settled = cases.filter((c) => !isOpen(c.status));

  return (
    <AppShell user={user} unread={unread}>
      <h1 className="display text-[28px] text-ink">{t("cases.title")}</h1>

      {cases.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white shadow-card">
          <EmptyState
            title={t("cases.emptyTitle")}
            body={t("cases.emptyBody")}
            action={
              <Link href="/home">
                <Button size="lg">{t("cases.emptyCta")}</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {t("cases.open", { count: open.length })}
            </h2>
            {open.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-line bg-white px-5 py-6 text-[14px] text-ink-mute shadow-card">
                {t("cases.nothingOpen")}
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
                {t("cases.settled", { count: settled.length })}
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

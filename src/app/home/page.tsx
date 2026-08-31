import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { listCases, listTasksForUser } from "@/server/services/cases";
import { unreadCount } from "@/server/services/notifications";
import { AppShell } from "@/components/nav/AppShell";
import { ProblemComposer } from "@/components/landing/ProblemComposer";
import { CaseCard } from "@/components/case/CaseCard";
import { EmptyState } from "@/components/ui/States";
import { greeting } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { renderSystemText } from "@/i18n/system-text";
import { isOpen } from "@/domain/status";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/home");

  const [{ t, dictionary }, cases, unread, tasks] = await Promise.all([
    getI18n(),
    listCases(user.id),
    unreadCount(user.id),
    listTasksForUser(user.id),
  ]);

  const open = cases.filter((c) => isOpen(c.status));
  const settled = cases.filter((c) => !isOpen(c.status));
  const firstName = user.displayName?.split(" ")[0];

  return (
    <AppShell user={user} unread={unread}>
      <section className="animate-fade-up">
        <h1 dir="auto" className="display text-[28px] text-ink sm:text-[34px]">
          {greeting(dictionary)}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-2 text-[15px] text-ink-mute sm:text-base">{t("home.prompt")}</p>

        <div className="mt-6">
          <ProblemComposer authed autoSubmitDraft size="compact" />
        </div>
      </section>

      {tasks.length > 0 && (
        <section className="mt-10 animate-fade-up">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {t("home.waitingOnYou")}
          </h2>
          <ul className="mt-3 space-y-2">
            {tasks.slice(0, 4).map((task) => (
              <li key={task.id}>
                <Link
                  href={`/cases/${task.caseId}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-[14px] transition-colors hover:bg-paper-sunk"
                >
                  <span dir="auto" className="text-ink">
                    {renderSystemText(t, task.titleText, task.title)}
                  </span>
                  <span className="shrink-0 text-[12.5px] text-ink-faint">{t("common.openCase")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 animate-fade-up">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {t("home.yourCases")}
          </h2>
          {cases.length > 0 && (
            <Link href="/cases" className="text-[13px] font-medium text-ink-mute hover:text-ink">
              {t("common.seeAll")}
            </Link>
          )}
        </div>

        {cases.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-line bg-white shadow-card">
            <EmptyState title={t("cases.emptyTitle")} body={t("cases.emptyBody")} />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...open, ...settled].slice(0, 6).map((record) => (
              <CaseCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

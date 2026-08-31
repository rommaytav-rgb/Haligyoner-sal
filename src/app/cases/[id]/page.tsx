import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { capabilities } from "@/lib/config";
import { getAIProvider } from "@/server/ai";
import { unreadCount } from "@/server/services/notifications";
import { listAuditForCase } from "@/server/services/audit";
import {
  listActions,
  listEvidence,
  listFacts,
  listMessages,
  listResearch,
  listTasks,
  listTimeline,
  requireOwnedCase,
} from "@/server/services/cases";
import { AppShell } from "@/components/nav/AppShell";
import { getI18n } from "@/i18n/server";
import { CaseWorkspace } from "@/components/case/CaseWorkspace";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/cases/${encodeURIComponent(id)}`);

  let record;
  try {
    record = await requireOwnedCase(user.id, id);
  } catch (error) {
    // A case belonging to someone else is a 404, never a hint that it exists.
    if (error instanceof AppError && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }

  const [facts, evidence, timeline, tasks, research, actions, messages, activity, unread] = await Promise.all([
    listFacts(id),
    listEvidence(id),
    listTimeline(id),
    listTasks(id),
    listResearch(id),
    listActions(id),
    listMessages(id),
    listAuditForCase(id, 30),
    unreadCount(user.id),
  ]);

  const provider = getAIProvider();
  const { t } = await getI18n();

  return (
    <AppShell user={user} unread={unread}>
      <Link href="/cases" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-mute hover:text-ink">
        {/* "Back" points the way the language reads. */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="rtl:-scale-x-100">
          <path
            d="M8.5 3.5L5 7l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t("common.allCases")}
      </Link>

      <CaseWorkspace
        initial={{ case: record, facts, evidence, timeline, tasks, research, actions, messages, activity }}
        capabilities={{
          aiModelBacked: provider.quality.modelBacked,
          aiLimitationNote: provider.quality.limitationKey ? t(provider.quality.limitationKey) : undefined,
          webResearch: capabilities.webResearch,
        }}
      />
    </AppShell>
  );
}

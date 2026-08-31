"use client";

import * as React from "react";
import type { CaseBundle, CaseCapabilities } from "./types";
import type { Translator } from "@/i18n/translate";
import { CASE_STATUS_TONE } from "@/domain/status";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { CapabilityNotice, EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { NextStepCard } from "./NextStepCard";
import { KnownPanel } from "./KnownPanel";
import { EvidencePanel } from "./EvidencePanel";
import { ConversationPanel } from "./ConversationPanel";
import { ResearchPanel } from "./ResearchPanel";
import { ActionCard } from "./ActionCard";
import { ApprovalCard } from "./ApprovalCard";
import { Timeline } from "./Timeline";
import { ResolutionPrompt } from "./ResolutionPrompt";
import { useI18n } from "@/i18n/client";

type TabId = "overview" | "evidence" | "plan" | "timeline" | "research" | "conversation" | "activity";

/**
 * The case dashboard. Structured panels do the work; the conversation is one
 * tab among them rather than the whole product (sections 3, 30).
 */
export function CaseWorkspace({ initial, capabilities }: { initial: CaseBundle; capabilities: CaseCapabilities }) {
  const { t, relativeTime } = useI18n();
  const [bundle, setBundle] = React.useState(initial);
  const [tab, setTab] = React.useState<TabId>("overview");
  const [sending, setSending] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState<null | string>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [researching, setResearching] = React.useState(false);
  const [researchUnavailable, setResearchUnavailable] = React.useState<string | undefined>();
  const [lastMessage, setLastMessage] = React.useState<string | null>(null);

  const record = bundle.case;
  const openQuestions = record.unknowns.filter((u) => !u.resolved);
  const awaitingApproval = bundle.actions.filter((a) => a.status === "REQUIRES_APPROVAL");
  const closed = record.status === "CLOSED";

  // Worth asking whether the problem is actually fixed once a step has been
  // acted on, or while a reply is outstanding - never before (section 65).
  const askAboutResolution =
    record.status !== "RESOLVED" &&
    record.status !== "CLOSED" &&
    (record.status === "WAITING_FOR_RESPONSE" ||
      record.status === "FOLLOW_UP_REQUIRED" ||
      bundle.actions.some((a) => a.status === "APPROVED" || a.status === "COMPLETED"));

  const refresh = React.useCallback(async () => {
    const response = await fetch(`/api/cases/${record.id}`);
    if (response.ok) setBundle(await response.json());
  }, [record.id]);

  async function sendMessage(content: string) {
    setSending(true);
    setChatError(null);
    setLastMessage(content);
    try {
      const response = await fetch(`/api/cases/${record.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("errors.generic"));
      await refresh();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSending(false);
    }
  }

  async function call(label: string, url: string, body?: unknown) {
    setWorking(label);
    setActionError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("errors.generic"));
      await refresh();
      return payload;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("errors.generic"));
      throw err;
    } finally {
      setWorking(null);
    }
  }

  async function retractFact(factId: string) {
    await fetch(`/api/cases/${record.id}/facts/${factId}`, { method: "DELETE" });
    await refresh();
  }

  async function runResearch() {
    setResearching(true);
    try {
      const response = await fetch(`/api/cases/${record.id}/research`, { method: "POST" });
      const payload = await response.json();
      if (!payload.ran) setResearchUnavailable(payload.unavailableReason);
      await refresh();
    } finally {
      setResearching(false);
    }
  }

  const tabs = [
    { id: "overview", label: t("caseView.tabs.overview") },
    { id: "evidence", label: t("caseView.tabs.evidence"), count: bundle.evidence.length },
    { id: "plan", label: t("caseView.tabs.plan"), count: bundle.actions.filter((a) => a.status !== "CANCELLED").length },
    { id: "timeline", label: t("caseView.tabs.timeline") },
    { id: "research", label: t("caseView.tabs.research"), count: bundle.research.length },
    { id: "conversation", label: t("caseView.tabs.conversation") },
    { id: "activity", label: t("caseView.tabs.activity") },
  ];

  return (
    <div>
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 dir="auto" className="display max-w-xl text-[26px] leading-tight text-ink sm:text-[32px]">
            {record.title}
          </h1>
          <Badge tone={CASE_STATUS_TONE[record.status]} dot>
            {t(`status.${record.status}`)}
          </Badge>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-faint">
          {record.primaryCategory && <span>{t(`category.${record.primaryCategory}`)}</span>}
          <span aria-hidden="true">&middot;</span>
          <span>{t("caseView.opened", { time: relativeTime(record.createdAt) })}</span>
          {record.userGoal && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span className="text-ink-mute">
                {t("caseView.goalLabel")}{" "}
                {/* The goal is case content and may be in the other language. */}
                <span dir="auto" className="bidi-isolate">
                  {record.userGoal}
                </span>
              </span>
            </>
          )}
        </div>
      </header>

      {record.riskLevel === "HIGH" && record.riskNoteKey && (
        <div className="mt-5">
          <CapabilityNotice>{t(record.riskNoteKey)}</CapabilityNotice>
        </div>
      )}

      {!capabilities.aiModelBacked && capabilities.aiLimitationNote && (
        <div className="mt-4">
          <CapabilityNotice>{capabilities.aiLimitationNote}</CapabilityNotice>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <NextStepCard
          record={record}
          onAct={
            openQuestions.length > 0
              ? () => setTab("conversation")
              : bundle.actions.length === 0
                ? () => void call("plan", `/api/cases/${record.id}/actions`)
                : undefined
          }
          actLabel={
            openQuestions.length > 0
              ? t("caseView.answerThis")
              : bundle.actions.length === 0
                ? t("caseView.buildPlan")
                : undefined
          }
          busy={working === "plan"}
        />

        {awaitingApproval.length > 0 && (
          <div className="space-y-4">
            {awaitingApproval.map((action) => (
              <ApprovalCard
                key={action.id}
                action={action}
                onApprove={async (editedBody) => {
                  const result = await call("approve", `/api/cases/${record.id}/actions/${action.id}/approve`, {
                    confirm: true,
                    editedBody,
                  });
                  if (result?.message) setActionError(null);
                }}
                onCancel={async () => {
                  await call("cancel", `/api/cases/${record.id}/actions/${action.id}/cancel`);
                }}
              />
            ))}
          </div>
        )}

        {askAboutResolution && (
          <ResolutionPrompt
            busy={working === "resolve"}
            onAnswer={async (resolved) => {
              await call("resolve", `/api/cases/${record.id}/resolve`, { resolved });
            }}
          />
        )}

        {actionError && <ErrorState title={t("common.somethingWentWrong")} body={actionError} />}
      </div>

      <div className="mt-8">
        <Tabs items={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />
      </div>

      <div className="mt-6 animate-fade-in">
        {tab === "overview" && <KnownPanel facts={bundle.facts} record={record} onRetract={retractFact} />}

        {tab === "evidence" && (
          <EvidencePanel caseId={record.id} evidence={bundle.evidence} onUploaded={refresh} />
        )}

        {tab === "plan" && (
          <PlanTab
            t={t}
            bundle={bundle}
            working={working}
            onBuild={() => void call("plan", `/api/cases/${record.id}/actions`)}
            onPrepare={(actionId) => void call("draft", `/api/cases/${record.id}/actions/${actionId}`)}
          />
        )}

        {tab === "timeline" && (
          bundle.timeline.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white shadow-card">
              <EmptyState title={t("caseView.timelineEmpty")} />
            </div>
          ) : (
            <Timeline events={bundle.timeline} />
          )
        )}

        {tab === "research" && (
          <ResearchPanel
            research={bundle.research}
            available={capabilities.webResearch}
            running={researching}
            unavailableReason={researchUnavailable}
            onRun={runResearch}
          />
        )}

        {tab === "conversation" && (
          <ConversationPanel
            messages={bundle.messages}
            sending={sending}
            error={chatError}
            disabled={closed}
            onSend={sendMessage}
            onRetry={() => lastMessage && void sendMessage(lastMessage)}
          />
        )}

        {tab === "activity" && <ActivityTab bundle={bundle} t={t} relativeTime={relativeTime} />}
      </div>
    </div>
  );
}

function PlanTab({
  t,
  bundle,
  working,
  onBuild,
  onPrepare,
}: {
  t: Translator;
  bundle: CaseBundle;
  working: string | null;
  onBuild: () => void;
  onPrepare: (actionId: string) => void;
}) {
  const actions = bundle.actions.filter((a) => a.status !== "CANCELLED");

  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white shadow-card">
        <EmptyState
          title={t("plan.emptyTitle")}
          body={t("plan.emptyBody")}
          action={
            <Button onClick={onBuild} loading={working === "plan"}>
              {t("caseView.buildPlan")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-mute">{t("plan.intro")}</p>
        <Button size="sm" variant="secondary" onClick={onBuild} loading={working === "plan"}>
          {t("plan.rebuild")}
        </Button>
      </div>
      {working === "draft" && <LoadingState message={t("plan.preparing")} />}
      <ol className="mt-4 space-y-3">
        {actions.map((action, index) => (
          <ActionCard key={action.id} action={action} index={index}>
            {(action.type === "DRAFT" || action.type === "EXTERNAL_ACTION") &&
              !action.draft &&
              action.status === "PENDING" && (
                <Button size="sm" variant="secondary" onClick={() => onPrepare(action.id)} loading={working === "draft"}>
                  {t("plan.prepareDraft")}
                </Button>
              )}
            {action.status === "APPROVED" && action.draft && (
              <div className="rounded-xl border border-line bg-paper-sunk p-4">
                <p className="text-[13px] font-medium text-ink">{t("plan.approvedTextLabel")}</p>
                {action.draft.subject && (
                  <p className="mt-2 text-[13.5px] font-medium text-ink-soft">
                    {t("plan.subjectLabel")}{" "}
                    <span dir="auto" className="bidi-isolate">
                      {action.draft.subject}
                    </span>
                  </p>
                )}
                <pre dir="auto" className="mt-2 whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink-soft">
                  {action.draft.body}
                </pre>
              </div>
            )}
          </ActionCard>
        ))}
      </ol>
    </div>
  );
}

function ActivityTab({
  bundle,
  t,
  relativeTime,
}: {
  bundle: CaseBundle;
  t: Translator;
  relativeTime: (iso: string) => string;
}) {
  if (bundle.activity.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white shadow-card">
        <EmptyState title={t("caseView.activityEmpty")} />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      {bundle.activity.map((event) => (
        <li key={event.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
          <div>
            <p className="text-[14px] text-ink">{t(`audit.${event.type}`)}</p>
            {/* Audit detail is technical - identifiers and outcomes, not prose. */}
            <p dir="ltr" className="text-start text-[12.5px] text-ink-faint">
              {event.detail}
            </p>
          </div>
          <span className="shrink-0 text-[12.5px] text-ink-faint">{relativeTime(event.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

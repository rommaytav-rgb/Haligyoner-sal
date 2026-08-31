import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import type { Case, LocalizedText } from "@/domain/types";
import { getAIProvider } from "@/server/ai";
import {
  addFact,
  addMessage,
  addTimelineEvent,
  buildCaseContext,
  listActions,
  patchCase,
  removeFact,
  requireOwnedCase,
  setStatus,
} from "@/server/services/cases";
import { caseText, systemText, type Recordable } from "@/server/i18n";
import { caseLocale } from "@/server/ai/language";
import { runInvestigation } from "./investigation-agent";
import { runPlanning } from "./planning-agent";
import { prepareDraft } from "./action-agent";

export type AgentName = "investigation" | "planning" | "action" | "none";

export interface OrchestrationStep {
  agent: AgentName;
  outcome: string;
}

export interface OrchestrationResult {
  case: Case;
  reply: string;
  appliedChanges: LocalizedText[];
  steps: OrchestrationStep[];
  /** Catalogue keys, populated when the run stopped because something is missing. */
  limitationKeys: string[];
}

/**
 * Agent orchestrator (section 22).
 *
 * Decides which agent should act next from the state of the Case, and stops.
 * The loop is bounded three ways - iteration count, tool budget and wall clock -
 * so a case can never spin autonomously.
 */
export async function advanceCase(
  userId: string,
  caseId: string,
  trigger: { kind: "MESSAGE"; message: string } | { kind: "REFRESH" },
): Promise<OrchestrationResult> {
  const started = Date.now();
  const steps: OrchestrationStep[] = [];
  const limitationKeys: string[] = [];
  const appliedChanges: LocalizedText[] = [];
  let budget = config.maxToolCalls;

  let record = await requireOwnedCase(userId, caseId);
  let reply = "";

  if (trigger.kind === "MESSAGE") {
    const result = await applyMessage(userId, record, trigger.message, appliedChanges);
    reply = result.reply;
    record = result.case;
  }

  for (let iteration = 0; iteration < config.maxAgentIterations; iteration += 1) {
    if (Date.now() - started > config.aiTimeoutMs * 2) {
      log.warn({ event: "orchestrator.timeout", caseId, iteration });
      break;
    }
    if (budget <= 0) {
      log.warn({ event: "orchestrator.budget_exhausted", caseId });
      break;
    }

    const next = await decideNextAgent(record);
    if (next === "none") break;

    budget -= 1;
    try {
      if (next === "investigation") {
        const result = await runInvestigation(userId, caseId);
        if (!result.ran) {
          if (result.unavailableKey) limitationKeys.push(result.unavailableKey);
          steps.push({ agent: "investigation", outcome: "not connected" });
          // Without research there is nothing more to learn; move to planning.
          record = await safeStatus(userId, record, "READY_FOR_ACTION", systemText("system.movingOn"));
          continue;
        }
        steps.push({ agent: "investigation", outcome: `${result.findingsAdded} findings` });
        if (result.findingsAdded > 0) {
          appliedChanges.push(
            systemText("agent.changeAddedResearch", { count: result.findingsAdded }, result.findingsAdded),
          );
        }
        record = await safeStatus(userId, record, "READY_FOR_ACTION", systemText("system.lookedIntoOptions"));
        continue;
      }

      if (next === "planning") {
        const plan = await runPlanning(userId, caseId);
        steps.push({ agent: "planning", outcome: `${plan.steps.length} steps` });
        appliedChanges.push(systemText("agent.changeBuiltPlan", { count: plan.steps.length }));
        record = await requireOwnedCase(userId, caseId);
        continue;
      }

      if (next === "action") {
        const actions = await listActions(caseId);
        const draftStep = actions.find((a) => a.type === "DRAFT" && a.status === "PENDING" && !a.draft);
        if (!draftStep) break;
        await prepareDraft(userId, caseId, draftStep.id);
        steps.push({ agent: "action", outcome: "draft prepared" });
        appliedChanges.push(systemText("agent.changePreparedDraft"));
        record = await requireOwnedCase(userId, caseId);
        continue;
      }
    } catch (error) {
      // A failing agent stops the run; it never invents a result (section 39).
      log.error({ event: "orchestrator.agent_failed", caseId, agent: next, error });
      steps.push({ agent: next, outcome: "failed" });
      limitationKeys.push("errors.orchestratorPartial");
      break;
    }
  }

  if (!reply) {
    reply = summarise(record, steps, limitationKeys);
  }

  log.info({
    event: "orchestrator.run",
    caseId,
    userId,
    durationMs: Date.now() - started,
    iterations: steps.length,
  });

  return { case: record, reply, appliedChanges, steps, limitationKeys };
}

/**
 * The routing rule. Deliberately explicit rather than model-driven: the state
 * machine decides what happens next, so behaviour is predictable and testable.
 */
export async function decideNextAgent(record: Case): Promise<AgentName> {
  // Only a genuinely required answer holds a case back. A "helpful" question
  // stays on the record and keeps being asked, but it never stalls the work.
  const blocking = record.unknowns.filter((u) => !u.resolved && u.importance === "REQUIRED");
  if (blocking.length > 0) return "none";

  switch (record.status) {
    case "NEW":
    case "INTAKE":
    case "INVESTIGATING":
      return "investigation";
    case "INFORMATION_REQUIRED":
      // Everything asked has been answered (checked above), so the case is no
      // longer waiting on the user and can move on.
      return "investigation";
    case "READY_FOR_ACTION": {
      const actions = await listActions(record.id);
      if (actions.length === 0) return "planning";
      return actions.some((a) => a.type === "DRAFT" && a.status === "PENDING" && !a.draft) ? "action" : "none";
    }
    default:
      return "none";
  }
}

/** Applies one user message to the structured Case, then replies (section 29). */
async function applyMessage(
  userId: string,
  record: Case,
  message: string,
  appliedChanges: LocalizedText[],
): Promise<{ case: Case; reply: string }> {
  await addMessage(record.id, "USER", message);
  const context = await buildCaseContext(record.id);

  let result;
  try {
    result = await getAIProvider().replyInCase(context, message);
  } catch (error) {
    log.error({ event: "orchestrator.reply_failed", caseId: record.id, error });
    throw new AppError("UPSTREAM_FAILED", "errors.replyFailed");
  }

  for (const fact of result.newFacts) {
    await addFact(
      record.id,
      { statement: fact.statement, verification: fact.verification, confidence: fact.confidence },
      { userId },
    );
  }
  if (result.newFacts.length) {
    appliedChanges.push(systemText("agent.changeRecordedDetails", { count: result.newFacts.length }, result.newFacts.length));
  }

  // A correction is accepted, not argued with (section 64).
  for (const factId of result.retractedFactIds) {
    try {
      await removeFact(userId, record.id, factId);
      appliedChanges.push(systemText("agent.changeRemovedDetail"));
    } catch {
      // Already gone.
    }
  }

  const answered = new Set(result.answeredUnknownIds);
  const unknowns = record.unknowns.map((u) => (answered.has(u.id) ? { ...u, resolved: true, answer: message } : u));
  const newUnknowns = result.newQuestions.map((q) => ({
    id: `unk_${Math.random().toString(36).slice(2, 12)}`,
    question: q.question,
    reason: q.reason,
    importance: q.importance,
    resolved: false,
    createdAt: new Date().toISOString(),
  }));
  if (answered.size) {
    appliedChanges.push(systemText("agent.changeAnsweredQuestions", { count: answered.size }, answered.size));
  }

  for (const entry of result.timeline) {
    await addTimelineEvent(record.id, {
      title: entry.title,
      description: entry.description,
      source: "USER",
    });
  }

  const stillOpen = [...unknowns.filter((u) => !u.resolved), ...newUnknowns];
  const stillBlocking = stillOpen.filter((u) => u.importance === "REQUIRED");
  let updated = await patchCase(userId, record.id, {
    unknowns: [...unknowns, ...newUnknowns],
    currentNextAction: (stillBlocking[0] ?? stillOpen[0])?.question ?? record.currentNextAction,
  });

  if (result.suggestedStatus) {
    updated = await safeStatus(userId, updated, result.suggestedStatus, systemText("system.updatedFromMessage"));
  } else if (stillBlocking.length === 0 && updated.status === "INFORMATION_REQUIRED") {
    updated = await safeStatus(userId, updated, "INVESTIGATING", systemText("system.youAnswered"));
  }

  await addMessage(record.id, "ASSISTANT", result.reply, appliedChanges);
  return { case: updated, reply: result.reply };
}

async function safeStatus(userId: string, record: Case, status: Case["status"], reason: Recordable): Promise<Case> {
  try {
    return await setStatus(userId, record.id, status, reason);
  } catch {
    return record;
  }
}

/**
 * A short summary of the run, written in the language of the case so it sits
 * naturally alongside the rest of the conversation.
 */
function summarise(record: Case, steps: OrchestrationStep[], limitationKeys: string[]): string {
  const locale = caseLocale(record.contentLocale);
  if (limitationKeys.length > 0) return limitationKeys.map((key) => caseText(key, undefined, locale)).join(" ");
  if (steps.length === 0) return caseText("agent.nothingToDo", undefined, locale);
  return caseText("agent.whereThingsStand", { next: record.currentNextAction ?? "" }, locale);
}

import { COLLECTIONS, getStore } from "@/server/db";
import { newId, now } from "@/domain/ids";
import { canTransition, isOpen } from "@/domain/status";
import type {
  ActionStep,
  Case,
  CaseMessage,
  CaseStatus,
  Evidence,
  Fact,
  ResearchItem,
  Task,
  TimelineEvent,
  UnknownItem,
} from "@/domain/types";
import { AppError, invalid, notFound } from "@/lib/errors";
import type { CaseContext } from "@/server/ai/provider";
import { audit } from "./audit";
import { notify } from "./notifications";
import { CASE_STATUS_LABEL } from "@/domain/status";

const store = () => getStore();

/**
 * Every case-scoped operation starts here. Ownership is checked against the
 * stored document, never against an id supplied by the client, and a case
 * belonging to someone else is indistinguishable from one that does not exist
 * (section 18).
 */
export async function requireOwnedCase(userId: string, caseId: string): Promise<Case> {
  const record = await store().get<Case>(COLLECTIONS.cases, caseId);
  if (!record) throw notFound("We couldn't find that case.");
  if (record.userId !== userId) {
    await audit("ACCESS_DENIED", `case ${caseId}`, { userId, caseId });
    throw notFound("We couldn't find that case.");
  }
  return record;
}

export async function listCases(userId: string): Promise<Case[]> {
  return store().query<Case>(COLLECTIONS.cases, [{ field: "userId", op: "==", value: userId }], {
    orderBy: { field: "updatedAt", direction: "desc" },
    limit: 100,
  });
}

export async function saveCase(record: Case): Promise<Case> {
  await store().put(COLLECTIONS.cases, record);
  return record;
}

export async function patchCase(userId: string, caseId: string, partial: Partial<Case>): Promise<Case> {
  await requireOwnedCase(userId, caseId);
  // userId is never patchable: a case cannot be moved between owners.
  const { userId: _ignored, id: _id, ...safe } = partial;
  return store().patch<Case>(COLLECTIONS.cases, caseId, { ...safe, updatedAt: now() });
}

export async function setStatus(
  userId: string,
  caseId: string,
  next: CaseStatus,
  reason: string,
  options: { userConfirmedResolution?: boolean } = {},
): Promise<Case> {
  const record = await requireOwnedCase(userId, caseId);
  if (record.status === next) return record;

  if (!canTransition(record.status, next)) {
    throw new AppError(
      "CONFLICT",
      `This case can't move from "${CASE_STATUS_LABEL[record.status]}" to "${CASE_STATUS_LABEL[next]}".`,
    );
  }

  // Resolution is a claim about the real world, so only the user can make it (section 65).
  if (next === "RESOLVED" && !options.userConfirmedResolution) {
    throw new AppError("CONFLICT", "A case is only marked resolved once you confirm the problem is actually fixed.");
  }

  const updated = await store().patch<Case>(COLLECTIONS.cases, caseId, {
    status: next,
    updatedAt: now(),
    ...(next === "RESOLVED" ? { resolutionConfirmedByUser: true } : {}),
  });

  await audit("STATUS_CHANGED", `${record.status} -> ${next}: ${reason}`, { userId, caseId });
  await addTimelineEvent(caseId, {
    title: `Status changed to "${CASE_STATUS_LABEL[next]}"`,
    description: reason,
    source: "SYSTEM",
  });
  await notify({
    userId,
    caseId,
    kind: "STATUS_CHANGE",
    title: `${record.title}: ${CASE_STATUS_LABEL[next]}`,
    body: reason,
  });
  return updated;
}

export async function deleteCase(userId: string, caseId: string): Promise<void> {
  await requireOwnedCase(userId, caseId);
  const collections = [
    COLLECTIONS.facts,
    COLLECTIONS.evidence,
    COLLECTIONS.timelineEvents,
    COLLECTIONS.tasks,
    COLLECTIONS.research,
    COLLECTIONS.actions,
    COLLECTIONS.messages,
  ];
  for (const collection of collections) {
    const docs = await store().query<{ id: string }>(collection, [{ field: "caseId", op: "==", value: caseId }]);
    for (const doc of docs) await store().remove(collection, doc.id);
  }
  await store().remove(COLLECTIONS.cases, caseId);
  await audit("CASE_UPDATED", "case deleted by user", { userId, caseId });
}

/* ---------------------------------------------------------------- facts -- */

export async function listFacts(caseId: string): Promise<Fact[]> {
  return store().query<Fact>(COLLECTIONS.facts, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "createdAt", direction: "asc" },
  });
}

export async function addFact(
  caseId: string,
  input: Omit<Fact, "id" | "caseId" | "createdAt">,
  scope: { userId?: string } = {},
): Promise<Fact> {
  const existing = await listFacts(caseId);
  const duplicate = existing.find(
    (f) => f.statement.trim().toLowerCase() === input.statement.trim().toLowerCase(),
  );
  if (duplicate) return duplicate;

  const fact: Fact = { id: newId("fct"), caseId, createdAt: now(), ...input };
  await store().put(COLLECTIONS.facts, fact);
  await audit("FACT_ADDED", `${fact.verification}/${fact.confidence}`, { userId: scope.userId, caseId });
  return fact;
}

export async function removeFact(userId: string, caseId: string, factId: string): Promise<void> {
  await requireOwnedCase(userId, caseId);
  const fact = await store().get<Fact>(COLLECTIONS.facts, factId);
  if (!fact || fact.caseId !== caseId) throw notFound("We couldn't find that detail.");
  await store().remove(COLLECTIONS.facts, factId);
  await audit("FACT_REMOVED", "retracted", { userId, caseId });
}

/* ------------------------------------------------------------- unknowns -- */

export function buildUnknown(input: { question: string; reason: string; importance: "REQUIRED" | "HELPFUL" }): UnknownItem {
  return { id: newId("unk"), resolved: false, createdAt: now(), ...input };
}

export async function resolveUnknown(userId: string, caseId: string, unknownId: string, answer: string): Promise<Case> {
  const record = await requireOwnedCase(userId, caseId);
  const target = record.unknowns.find((u) => u.id === unknownId);
  if (!target) throw notFound("We couldn't find that question.");

  const unknowns = record.unknowns.map((u) => (u.id === unknownId ? { ...u, resolved: true, answer } : u));
  await addFact(caseId, {
    statement: `${target.question} ${answer}`,
    verification: "USER_REPORTED",
    confidence: "HIGH",
  }, { userId });

  const updated = await store().patch<Case>(COLLECTIONS.cases, caseId, { unknowns, updatedAt: now() });

  // Answering the last required question means the case is no longer blocked on the user.
  if (
    updated.status === "INFORMATION_REQUIRED" &&
    unknowns.every((u) => u.resolved || u.importance !== "REQUIRED")
  ) {
    return setStatus(userId, caseId, "INVESTIGATING", "You answered everything we needed.");
  }
  return updated;
}

/* ------------------------------------------------------------- timeline -- */

export async function listTimeline(caseId: string): Promise<TimelineEvent[]> {
  return store().query<TimelineEvent>(COLLECTIONS.timelineEvents, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "createdAt", direction: "asc" },
  });
}

export async function addTimelineEvent(
  caseId: string,
  input: Omit<TimelineEvent, "id" | "caseId" | "createdAt">,
): Promise<TimelineEvent> {
  const event: TimelineEvent = { id: newId("tml"), caseId, createdAt: now(), ...input };
  await store().put(COLLECTIONS.timelineEvents, event);
  return event;
}

/* ---------------------------------------------------------------- tasks -- */

export async function listTasks(caseId: string): Promise<Task[]> {
  return store().query<Task>(COLLECTIONS.tasks, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "createdAt", direction: "asc" },
  });
}

export async function listTasksForUser(userId: string): Promise<Task[]> {
  const cases = await listCases(userId);
  const open = cases.filter((c) => isOpen(c.status));
  const all: Task[] = [];
  for (const c of open) all.push(...(await listTasks(c.id)));
  return all.filter((t) => t.status === "PENDING");
}

export async function addTask(caseId: string, input: Omit<Task, "id" | "caseId" | "createdAt" | "status">): Promise<Task> {
  const task: Task = { id: newId("tsk"), caseId, status: "PENDING", createdAt: now(), ...input };
  await store().put(COLLECTIONS.tasks, task);
  return task;
}

export async function updateTask(userId: string, taskId: string, status: Task["status"]): Promise<Task> {
  const task = await store().get<Task>(COLLECTIONS.tasks, taskId);
  if (!task) throw notFound("We couldn't find that task.");
  await requireOwnedCase(userId, task.caseId);
  return store().patch<Task>(COLLECTIONS.tasks, taskId, { status });
}

/* ------------------------------------------------------------- research -- */

export async function listResearch(caseId: string): Promise<ResearchItem[]> {
  return store().query<ResearchItem>(COLLECTIONS.research, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "retrievedAt", direction: "desc" },
  });
}

export async function addResearch(caseId: string, input: Omit<ResearchItem, "id" | "caseId">): Promise<ResearchItem> {
  const item: ResearchItem = { id: newId("res"), caseId, ...input };
  await store().put(COLLECTIONS.research, item);
  return item;
}

/* -------------------------------------------------------------- actions -- */

export async function listActions(caseId: string): Promise<ActionStep[]> {
  return store().query<ActionStep>(COLLECTIONS.actions, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "order", direction: "asc" },
  });
}

export async function addAction(
  caseId: string,
  input: Omit<ActionStep, "id" | "caseId" | "createdAt" | "updatedAt">,
): Promise<ActionStep> {
  const step: ActionStep = { id: newId("act"), caseId, createdAt: now(), updatedAt: now(), ...input };
  await store().put(COLLECTIONS.actions, step);
  return step;
}

export async function patchAction(
  userId: string,
  caseId: string,
  actionId: string,
  partial: Partial<ActionStep>,
): Promise<ActionStep> {
  await requireOwnedCase(userId, caseId);
  const action = await store().get<ActionStep>(COLLECTIONS.actions, actionId);
  if (!action || action.caseId !== caseId) throw notFound("We couldn't find that step.");
  return store().patch<ActionStep>(COLLECTIONS.actions, actionId, { ...partial, updatedAt: now() });
}

export async function replacePlan(
  caseId: string,
  steps: Omit<ActionStep, "id" | "caseId" | "createdAt" | "updatedAt">[],
): Promise<ActionStep[]> {
  const existing = await listActions(caseId);
  // Anything the user already acted on is preserved; only untouched proposals
  // are replaced, so a regenerated plan never erases an approval.
  const keep = existing.filter((a) => a.status !== "PENDING" && a.status !== "REQUIRES_APPROVAL");
  for (const stale of existing.filter((a) => !keep.includes(a))) {
    await store().remove(COLLECTIONS.actions, stale.id);
  }
  const created: ActionStep[] = [];
  for (const [index, step] of steps.entries()) {
    created.push(await addAction(caseId, { ...step, order: keep.length + index }));
  }
  return [...keep, ...created];
}

/* ------------------------------------------------------------- messages -- */

export async function listMessages(caseId: string, limit = 100): Promise<CaseMessage[]> {
  const messages = await store().query<CaseMessage>(COLLECTIONS.messages, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "createdAt", direction: "asc" },
  });
  return messages.slice(-limit);
}

export async function addMessage(
  caseId: string,
  role: CaseMessage["role"],
  content: string,
  appliedChanges?: string[],
): Promise<CaseMessage> {
  const message: CaseMessage = {
    id: newId("msg"),
    caseId,
    role,
    content,
    appliedChanges: appliedChanges?.length ? appliedChanges : undefined,
    createdAt: now(),
  };
  await store().put(COLLECTIONS.messages, message);
  return message;
}

/* ------------------------------------------------------------- evidence -- */

export async function listEvidence(caseId: string): Promise<Evidence[]> {
  return store().query<Evidence>(COLLECTIONS.evidence, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "createdAt", direction: "desc" },
  });
}

/* -------------------------------------------------------------- context -- */

/**
 * Assembles the minimum a model needs: the case, its facts, open questions,
 * evidence, research, plan and the tail of the conversation (section 58).
 */
export async function buildCaseContext(caseId: string, options: { messageLimit?: number } = {}): Promise<CaseContext> {
  const record = await store().get<Case>(COLLECTIONS.cases, caseId);
  if (!record) throw notFound("We couldn't find that case.");

  const [facts, evidence, research, actions, messages] = await Promise.all([
    listFacts(caseId),
    listEvidence(caseId),
    listResearch(caseId),
    listActions(caseId),
    listMessages(caseId, options.messageLimit ?? 8),
  ]);

  return {
    caseRecord: {
      id: record.id,
      title: record.title,
      summary: record.summary,
      originalProblem: record.originalProblem,
      userGoal: record.userGoal,
      primaryCategory: record.primaryCategory,
      status: record.status,
      riskLevel: record.riskLevel,
    },
    facts: facts.map((f) => ({
      id: f.id,
      statement: f.statement,
      verification: f.verification,
      confidence: f.confidence,
    })),
    unknowns: record.unknowns.map((u) => ({
      id: u.id,
      question: u.question,
      reason: u.reason,
      importance: u.importance,
      resolved: u.resolved,
    })),
    evidence: evidence.map((e) => ({
      id: e.id,
      fileName: e.fileName,
      evidenceType: e.evidenceType,
      processingStatus: e.processingStatus,
      extractedText: e.extractedText?.slice(0, 3000),
    })),
    research: research.map((r) => ({
      question: r.question,
      finding: r.finding,
      sourceUrl: r.sourceUrl,
      confidence: r.confidence,
    })),
    actions: actions.map((a) => ({ id: a.id, title: a.title, type: a.type, status: a.status })),
    recentMessages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}

export function assertOpenForEditing(record: Case): void {
  if (record.status === "CLOSED") {
    throw invalid("This case is closed. Reopen it to make changes.");
  }
}


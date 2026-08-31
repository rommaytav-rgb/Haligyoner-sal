import { automationAllowed } from "@/domain/risk";
import type { ActionStep, CaseStatus, Fact, TimelineEvent } from "@/domain/types";
import { getAIProvider } from "@/server/ai";
import { buildCaseContext, addFact, addTimelineEvent, addTask, setStatus, patchCase } from "@/server/services/cases";
import type { Tool } from "./types";

/**
 * Tools that write to the Case. Each one goes through the service layer, so
 * ownership checks and audit entries cannot be bypassed by an agent.
 */

export const addFactTool: Tool<
  { caseId: string; statement: string; verification: Fact["verification"]; confidence: Fact["confidence"] },
  { factId: string }
> = {
  name: "addFact",
  description: "Record a discrete claim or verified detail against a case.",
  available: true,
  requiresApproval: false,
  async run(input, context) {
    const fact = await addFact(
      input.caseId,
      { statement: input.statement, verification: input.verification, confidence: input.confidence },
      { userId: context.userId },
    );
    return { ok: true, data: { factId: fact.id } };
  },
};

export const addTimelineEventTool: Tool<
  { caseId: string; title: string; description: string; source: TimelineEvent["source"] },
  { eventId: string }
> = {
  name: "addTimelineEvent",
  description: "Add a dated event to the case history.",
  available: true,
  requiresApproval: false,
  async run(input) {
    const event = await addTimelineEvent(input.caseId, {
      title: input.title,
      description: input.description,
      source: input.source,
    });
    return { ok: true, data: { eventId: event.id } };
  },
};

export const addTaskTool: Tool<
  { caseId: string; title: string; description?: string; priority: "LOW" | "MEDIUM" | "HIGH"; dueAt?: string },
  { taskId: string }
> = {
  name: "addTask",
  description: "Create a task for the user or for follow-up.",
  available: true,
  requiresApproval: false,
  async run(input) {
    const task = await addTask(input.caseId, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.dueAt,
      assignedTo: "USER",
    });
    return { ok: true, data: { taskId: task.id } };
  },
};

export const updateCaseStatusTool: Tool<{ caseId: string; status: CaseStatus; reason: string }, { status: CaseStatus }> =
  {
    name: "updateCaseStatus",
    description: "Move a case to a new status.",
    available: true,
    requiresApproval: false,
    async run(input, context) {
      // RESOLVED is refused here by the service: only the user can confirm it.
      const updated = await setStatus(context.userId, input.caseId, input.status, input.reason);
      return { ok: true, data: { status: updated.status } };
    },
  };

export const updateCaseTool: Tool<
  { caseId: string; title?: string; summary?: string; userGoal?: string; currentNextAction?: string },
  { caseId: string }
> = {
  name: "updateCase",
  description: "Update the case headline fields.",
  available: true,
  requiresApproval: false,
  async run(input, context) {
    const { caseId, ...fields } = input;
    await patchCase(context.userId, caseId, fields);
    return { ok: true, data: { caseId } };
  },
};

export const createDraftTool: Tool<
  { caseId: string; action: Pick<ActionStep, "title" | "description"> },
  { channel: string; subject?: string; body: string; sharedInformation: string[] }
> = {
  name: "createDraft",
  description: "Prepare a message for the user to review. Never sends anything.",
  available: true,
  // The draft itself is harmless; sending it is what needs approval.
  requiresApproval: false,
  async run(input, context) {
    if (!automationAllowed(context.riskLevel, "DRAFT")) {
      return { ok: false, reason: "NOT_PERMITTED", message: "We won't draft this automatically for a high-risk case." };
    }
    const context_ = await buildCaseContext(input.caseId);
    const draft = await getAIProvider().draftCommunication(context_, input.action);
    return {
      ok: true,
      data: {
        channel: draft.channel,
        subject: draft.subject,
        body: draft.body,
        sharedInformation: draft.sharedInformation,
      },
    };
  },
};

export const prepareFormTool: Tool<{ caseId: string; formName: string }, { fields: { label: string; value: string }[] }> =
  {
    name: "prepareForm",
    description: "Collect the values a known form would need from the case record.",
    available: true,
    requiresApproval: false,
    async run(input) {
      const context = await buildCaseContext(input.caseId);
      const fields = [
        { label: "What happened", value: context.caseRecord.summary },
        { label: "What I'm asking for", value: context.caseRecord.userGoal ?? "" },
        ...context.facts
          .filter((f) => /\d/.test(f.statement))
          .slice(0, 6)
          .map((f) => ({ label: "Detail", value: f.statement })),
      ].filter((f) => f.value.length > 0);
      return { ok: true, data: { fields } };
    },
  };

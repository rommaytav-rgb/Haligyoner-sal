import type { ActionDraft, ActionStep, Case } from "@/domain/types";
import { AppError, invalid } from "@/lib/errors";
import { getAIProvider } from "@/server/ai";
import {
  addTimelineEvent,
  buildCaseContext,
  patchAction,
  patchCase,
  requireOwnedCase,
  setStatus,
} from "@/server/services/cases";
import { audit } from "@/server/services/audit";
import { notify } from "@/server/services/notifications";
import { guardAction } from "./risk-agent";
import { canExecuteType, findProvider } from "@/server/services/action-providers";

/**
 * Action Agent (section 21).
 *
 * Prepares drafts and carries out approved steps. It only ever reports what
 * actually happened: if no provider can perform a step, the step stays a draft
 * and says so (section 25).
 */

export async function prepareDraft(userId: string, caseId: string, actionId: string): Promise<ActionStep> {
  const record = await requireOwnedCase(userId, caseId);
  const context = await buildCaseContext(caseId);
  const actions = context.actions.find((a) => a.id === actionId);
  if (!actions) throw invalid("We couldn't find that step.");

  const stored = await patchAction(userId, caseId, actionId, { status: "IN_PROGRESS" });
  try {
    const result = await getAIProvider().draftCommunication(context, {
      title: stored.title,
      description: stored.description,
    });

    const draft: ActionDraft = {
      channel: result.channel,
      recipient: result.recipient,
      subject: result.subject,
      body: result.body,
      sharedInformation: result.sharedInformation,
    };

    const updated = await patchAction(userId, caseId, actionId, {
      draft,
      status: "REQUIRES_APPROVAL",
      requiresApproval: true,
      // Re-checked at draft time so the approval screen describes what will
      // really happen, not what the plan assumed.
      toolAvailable: canExecuteType(stored.type),
      deliveryState: "DRAFTED",
    });

    await patchCase(userId, caseId, { currentNextAction: `Review and approve: ${stored.title}` });

    await audit("ACTION_DRAFTED", `${draft.channel}`, { userId, caseId });
    await setStatusQuietly(record, userId, "AWAITING_USER_APPROVAL", "A draft is ready for you to review.");
    await notify({
      userId,
      caseId,
      kind: "APPROVAL_REQUIRED",
      title: record.title,
      body: "Draft ready for your approval.",
    });
    return updated;
  } catch (error) {
    await patchAction(userId, caseId, actionId, { status: "FAILED" });
    throw error instanceof AppError
      ? error
      : new AppError("UPSTREAM_FAILED", "We couldn't prepare that draft. Nothing was sent.");
  }
}

export async function approveAction(
  userId: string,
  caseId: string,
  actionId: string,
  editedBody?: string,
): Promise<{ action: ActionStep; performed: boolean; message: string }> {
  const record = await requireOwnedCase(userId, caseId);
  const step = await getStep(userId, caseId, actionId);

  if (step.status === "COMPLETED") throw invalid("That step is already done.");
  if (step.status === "CANCELLED") throw invalid("That step was cancelled.");

  const guard = guardAction(record, step);
  const draft = editedBody && step.draft ? { ...step.draft, body: editedBody, editedByUser: true } : step.draft;

  await audit("USER_APPROVED_ACTION", `${step.type} ${step.toolName ?? "no-tool"}`, { userId, caseId });

  const provider = findProvider(step);
  if (!provider || !guard.allowed) {
    // Approved, but nothing can carry it out here. Say exactly that.
    const message =
      guard.blockedReason ??
      "This is approved and ready. Sending it isn't connected here yet, so copy the text below and send it yourself - " +
        "then tell us when you have, and we'll track the reply.";
    const updated = await patchAction(userId, caseId, actionId, {
      status: "APPROVED",
      draft,
      deliveryState: "APPROVED",
    });
    await addTimelineEvent(caseId, {
      title: "You approved a draft",
      description: message,
      source: "USER",
    });
    await setStatusQuietly(record, userId, "READY_FOR_ACTION", "You approved the draft.");
    return { action: updated, performed: false, message };
  }

  await patchAction(userId, caseId, actionId, { status: "IN_PROGRESS", draft, deliveryState: "IN_PROGRESS" });
  const result = await provider.execute({ ...step, draft }, { userId, approvedAt: new Date().toISOString() });

  const updated = await patchAction(userId, caseId, actionId, {
    status: result.ok ? "COMPLETED" : "FAILED",
    deliveryState: result.deliveryState,
  });
  await audit("ACTION_EXECUTED", `${step.toolName}: ${result.deliveryState}`, { userId, caseId });
  await addTimelineEvent(caseId, {
    title: result.ok ? "Action carried out" : "Action failed",
    description: result.message,
    source: "SYSTEM",
  });
  if (result.ok) {
    await setStatusQuietly(record, userId, "WAITING_FOR_RESPONSE", "We're waiting on a reply.");
  }
  return { action: updated, performed: result.ok, message: result.message };
}

export async function cancelAction(userId: string, caseId: string, actionId: string): Promise<ActionStep> {
  const step = await getStep(userId, caseId, actionId);
  if (step.status === "COMPLETED") throw invalid("That step already happened, so it can't be cancelled.");
  const updated = await patchAction(userId, caseId, actionId, { status: "CANCELLED" });
  await audit("ACTION_CANCELLED", step.title.slice(0, 80), { userId, caseId });
  return updated;
}

async function getStep(userId: string, caseId: string, actionId: string): Promise<ActionStep> {
  const { COLLECTIONS, getStore } = await import("@/server/db");
  const step = await getStore().get<ActionStep>(COLLECTIONS.actions, actionId);
  if (!step || step.caseId !== caseId) throw invalid("We couldn't find that step.");
  await requireOwnedCase(userId, caseId);
  return step;
}

/** Status moves that must not fail the operation they accompany. */
async function setStatusQuietly(record: Case, userId: string, status: Case["status"], reason: string): Promise<void> {
  try {
    await setStatus(userId, record.id, status, reason);
  } catch {
    // An illegal transition here is not worth failing the user's action over.
  }
}


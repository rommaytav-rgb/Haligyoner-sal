import type { ActionStep } from "@/domain/types";
import { log } from "@/lib/logger";
import { getAIProvider } from "@/server/ai";
import { canExecuteType } from "@/server/services/action-providers";
import { buildCaseContext, patchCase, replacePlan, requireOwnedCase } from "@/server/services/cases";
import { audit } from "@/server/services/audit";
import { guardAction } from "./risk-agent";

export interface PlanningResult {
  steps: ActionStep[];
  nextAction: string;
}

/**
 * Planning Agent (section 21).
 *
 * Turns the case into an ordered plan. Every step is passed through the risk
 * guard, so a step that would need a capability this deployment lacks is marked
 * unavailable rather than promised.
 */
export async function runPlanning(userId: string, caseId: string): Promise<PlanningResult> {
  const record = await requireOwnedCase(userId, caseId);
  const context = await buildCaseContext(caseId);

  const plan = await getAIProvider().generateActionPlan(context);

  const prepared = plan.steps.map((step, index) => {
    const toolName = step.type === "EXTERNAL_ACTION" ? "sendEmail" : undefined;
    const guard = guardAction(record, { type: step.type, toolName });
    // Reflects whether the step can actually be carried out, not merely whether
    // a draft can be written for it.
    const deliverable = canExecuteType(step.type);

    return {
      order: index,
      title: step.title,
      description: describeStep(step.description, guard.blockedReason, deliverable, step.type),
      type: step.type,
      // A gated step only reaches REQUIRES_APPROVAL once there is something
      // concrete to approve; until then it is simply the next thing to do.
      status: "PENDING" as ActionStep["status"],
      requiresApproval: guard.requiresApproval,
      toolName,
      toolAvailable: deliverable,
    };
  });

  const steps = await replacePlan(caseId, prepared);
  await patchCase(userId, caseId, { currentNextAction: plan.nextAction });
  await audit("PLAN_CREATED", `${steps.length} steps`, { userId, caseId });
  log.info({ event: "planning.completed", caseId, steps: steps.length });

  return { steps, nextAction: plan.nextAction };
}

/** Appends the honest caveat to a step that cannot be carried out from here. */
function describeStep(
  description: string,
  blockedReason: string | undefined,
  deliverable: boolean,
  type: ActionStep["type"],
): string {
  if (blockedReason) return `${description}\n\n${blockedReason}`;
  if (!deliverable && (type === "DRAFT" || type === "EXTERNAL_ACTION")) {
    return `${description}\n\nWe'll prepare this for you to send yourself - sending on your behalf isn't connected here.`;
  }
  return description;
}

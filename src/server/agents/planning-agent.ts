import type { ActionStep } from "@/domain/types";
import { log } from "@/lib/logger";
import { getAIProvider } from "@/server/ai";
import { canExecuteType } from "@/server/services/action-providers";
import { buildCaseContext, patchCase, replacePlan, requireOwnedCase } from "@/server/services/cases";
import { audit } from "@/server/services/audit";
import { guardAction } from "./risk-agent";
import { caseText } from "@/server/i18n";
import { caseLocale } from "@/server/ai/language";
import type { Locale } from "@/i18n/config";

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
  const locale = caseLocale(record.contentLocale);

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
      description: describeStep(step.description, guard, deliverable, step.type, locale),
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

/**
 * Appends the honest caveat to a step that cannot be carried out from here.
 *
 * A step description is case content and stays in the case's language; the
 * caveat is rendered from the catalogue at the language the case was written
 * in, so the whole description reads as one piece.
 */
function describeStep(
  description: string,
  guard: { blockedKey?: string; blockedParams?: Record<string, string | number> },
  deliverable: boolean,
  type: ActionStep["type"],
  locale: Locale,
): string {
  if (guard.blockedKey) {
    return `${description}\n\n${caseText(guard.blockedKey, guard.blockedParams, locale)}`;
  }
  if (!deliverable && (type === "DRAFT" || type === "EXTERNAL_ACTION")) {
    return `${description}\n\n${caseText("plan.notConnectedNote", undefined, locale)}`;
  }
  return description;
}

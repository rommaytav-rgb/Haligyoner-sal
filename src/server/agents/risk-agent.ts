import { automationAllowed, classifyRisk, combineRisk } from "@/domain/risk";
import type { ActionStep, Case, RiskLevel } from "@/domain/types";
import { getTool } from "@/server/tools";

/**
 * Risk Agent (section 21).
 *
 * Decides how much the system may do on its own. It never lowers the
 * rule-based floor, and it is the only place that answers "may this run without
 * a human?".
 */
export interface RiskDecision {
  level: RiskLevel;
  note: string;
  requiresProfessionalDisclaimer: boolean;
}

export function assessRisk(problemText: string, modelSuggestion?: RiskLevel): RiskDecision {
  const floor = classifyRisk(problemText);
  const level = combineRisk(floor.level, modelSuggestion);
  return {
    level,
    note: level === floor.level ? floor.note : classifyRisk("").note,
    requiresProfessionalDisclaimer: level === "HIGH",
  };
}

export interface ActionGuard {
  allowed: boolean;
  requiresApproval: boolean;
  /** Present when the step names a capability this deployment does not have. */
  blockedReason?: string;
}

/**
 * Gate applied to every step before it can move beyond a proposal. Anything
 * leaving the user's control needs an explicit approval, always (section 24).
 */
export function guardAction(record: Case, step: Pick<ActionStep, "type" | "toolName">): ActionGuard {
  const tool = step.toolName ? getTool(step.toolName) : undefined;

  // Anything that would leave the user's hands is gated, always.
  const consequential = step.type === "EXTERNAL_ACTION" || step.type === "DRAFT";

  if (step.toolName && !tool) {
    return { allowed: false, requiresApproval: true, blockedReason: `We don't have a "${step.toolName}" capability.` };
  }
  if (tool && !tool.available) {
    return { allowed: false, requiresApproval: true, blockedReason: tool.unavailableReason };
  }
  if (!automationAllowed(record.riskLevel, step.type)) {
    return {
      allowed: true,
      requiresApproval: true,
      blockedReason: "This case is high-risk, so nothing runs without you reviewing it first.",
    };
  }
  return { allowed: true, requiresApproval: consequential };
}

export const HIGH_RISK_DISCLAIMER =
  "We can organise this and explain what we found, but we're not lawyers, doctors or licensed advisers, " +
  "and this isn't professional advice. For something this consequential, it's worth speaking to a qualified professional too.";

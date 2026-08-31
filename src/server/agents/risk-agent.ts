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
  /** Catalogue key for the note shown on the case. */
  noteKey: string;
  requiresProfessionalDisclaimer: boolean;
}

export function assessRisk(problemText: string, modelSuggestion?: RiskLevel): RiskDecision {
  const floor = classifyRisk(problemText);
  const level = combineRisk(floor.level, modelSuggestion);
  return {
    // The note always matches the level actually applied, which a model may
    // have raised above the rule-based floor.
    noteKey: `risk.${level.toLowerCase()}`,
    level,
    requiresProfessionalDisclaimer: level === "HIGH",
  };
}

export interface ActionGuard {
  allowed: boolean;
  requiresApproval: boolean;
  /** Catalogue key naming the missing capability, when there is one. */
  blockedKey?: string;
  blockedParams?: Record<string, string | number>;
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
    return {
      allowed: false,
      requiresApproval: true,
      blockedKey: "unavailable.unknownTool",
      blockedParams: { tool: step.toolName },
    };
  }
  if (tool && !tool.available) {
    return {
      allowed: false,
      requiresApproval: true,
      blockedKey: tool.unavailableKey,
      blockedParams: tool.unavailableParams,
    };
  }
  if (!automationAllowed(record.riskLevel, step.type)) {
    return { allowed: true, requiresApproval: true, blockedKey: "unavailable.highRiskManual" };
  }
  return { allowed: true, requiresApproval: consequential };
}

/** Catalogue key for the note attached to a high-risk case. */
export const HIGH_RISK_DISCLAIMER_KEY = "risk.professionalDisclaimer";

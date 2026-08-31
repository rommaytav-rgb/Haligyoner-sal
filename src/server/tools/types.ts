import type { RiskLevel } from "@/domain/types";

export interface ToolContext {
  userId: string;
  caseId?: string;
  riskLevel: RiskLevel;
}

export type ToolResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: "UNAVAILABLE" | "FAILED" | "NOT_PERMITTED";
      /** Catalogue key, so the reason reaches the user in their own language. */
      messageKey: string;
      messageParams?: Record<string, string | number>;
    };

/**
 * A capability the orchestrator can call.
 *
 * `available` is the product's honesty switch: an unavailable tool is shown as
 * not connected rather than simulated, and the orchestrator will not plan
 * around it (sections 23, 51).
 */
export interface Tool<Input, Output> {
  readonly name: string;
  /** Catalogue key for the description shown in Settings. */
  readonly descriptionKey: string;
  readonly available: boolean;
  /** Catalogue key explaining why the capability is missing. */
  readonly unavailableKey?: string;
  /** Parameters for `unavailableKey`, when it names something. */
  readonly unavailableParams?: Record<string, string | number>;
  /** True when a human must approve before this runs. */
  readonly requiresApproval: boolean;
  run(input: Input, context: ToolContext): Promise<ToolResult<Output>>;
}

export function unavailableTool<I, O>(
  name: string,
  unavailableKey: string,
  unavailableParams?: Record<string, string | number>,
  requiresApproval = true,
): Tool<I, O> {
  return {
    name,
    descriptionKey: `tools.${name}.description`,
    available: false,
    unavailableKey,
    unavailableParams,
    requiresApproval,
    async run() {
      // The caller translates; the tool layer never renders a language.
      return { ok: false, reason: "UNAVAILABLE", messageKey: unavailableKey, messageParams: unavailableParams };
    },
  };
}

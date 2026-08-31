import type { RiskLevel } from "@/domain/types";

export interface ToolContext {
  userId: string;
  caseId?: string;
  riskLevel: RiskLevel;
}

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "UNAVAILABLE" | "FAILED" | "NOT_PERMITTED"; message: string };

/**
 * A capability the orchestrator can call.
 *
 * `available` is the product's honesty switch: an unavailable tool is shown as
 * not connected rather than simulated, and the orchestrator will not plan
 * around it (sections 23, 51).
 */
export interface Tool<Input, Output> {
  readonly name: string;
  readonly description: string;
  readonly available: boolean;
  readonly unavailableReason?: string;
  /** True when a human must approve before this runs. */
  readonly requiresApproval: boolean;
  run(input: Input, context: ToolContext): Promise<ToolResult<Output>>;
}

export function unavailableTool<I, O>(
  name: string,
  description: string,
  reason: string,
  requiresApproval = true,
): Tool<I, O> {
  return {
    name,
    description,
    available: false,
    unavailableReason: reason,
    requiresApproval,
    async run() {
      return { ok: false, reason: "UNAVAILABLE", message: reason };
    },
  };
}

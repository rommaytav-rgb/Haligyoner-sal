import type { ActionStep, DeliveryState } from "@/domain/types";

export interface UserApproval {
  userId: string;
  approvedAt: string;
}

export interface PreparedAction {
  summary: string;
  recipient?: string;
  sharedInformation: string[];
}

export interface ActionResult {
  ok: boolean;
  deliveryState: DeliveryState;
  /** Catalogue key describing what actually happened, and nothing more. */
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

/**
 * Pluggable execution back-end for an approved step (section 62).
 *
 * No provider is registered in this deployment, which is the honest position:
 * an approved draft is handed back to the user to send. Registering an
 * EmailProvider here is all that is needed to close that loop later.
 */
export interface ActionProvider {
  readonly name: string;
  canHandle(action: ActionStep): boolean;
  prepare(action: ActionStep): Promise<PreparedAction>;
  execute(action: ActionStep, approval: UserApproval): Promise<ActionResult>;
}

const providers: ActionProvider[] = [];

export function registerActionProvider(provider: ActionProvider): void {
  providers.push(provider);
}

export function findProvider(action: ActionStep): ActionProvider | undefined {
  return providers.find((p) => p.canHandle(action));
}

export function listActionProviders(): string[] {
  return providers.map((p) => p.name);
}

/**
 * Whether a step of this kind could actually be carried out here. This is what
 * the approval screen must be built on: a draft the product cannot send must
 * never be described as one it will send (section 25).
 */
export function canExecuteType(type: ActionStep["type"]): boolean {
  if (type === "INFORMATION" || type === "RECOMMENDATION") return true;
  return providers.some((p) => p.canHandle({ type } as ActionStep));
}

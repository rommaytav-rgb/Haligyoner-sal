import type { CaseStatus } from "./types";

/** Human-facing label for a case status. Code stays technical, UI does not (§68). */
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  NEW: "Just started",
  INTAKE: "Understanding your problem",
  INVESTIGATING: "Looking into it",
  INFORMATION_REQUIRED: "Needs your input",
  READY_FOR_ACTION: "Ready to act",
  AWAITING_USER_APPROVAL: "Waiting for your approval",
  ACTION_IN_PROGRESS: "Action in progress",
  WAITING_FOR_RESPONSE: "Waiting for a response",
  FOLLOW_UP_REQUIRED: "Follow-up needed",
  ESCALATION_AVAILABLE: "You can escalate",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const CASE_STATUS_TONE: Record<CaseStatus, "neutral" | "info" | "warn" | "ok"> = {
  NEW: "neutral",
  INTAKE: "info",
  INVESTIGATING: "info",
  INFORMATION_REQUIRED: "warn",
  READY_FOR_ACTION: "info",
  AWAITING_USER_APPROVAL: "warn",
  ACTION_IN_PROGRESS: "info",
  WAITING_FOR_RESPONSE: "neutral",
  FOLLOW_UP_REQUIRED: "warn",
  ESCALATION_AVAILABLE: "warn",
  RESOLVED: "ok",
  CLOSED: "neutral",
};

const OPEN_STATES: CaseStatus[] = [
  "NEW",
  "INTAKE",
  "INVESTIGATING",
  "INFORMATION_REQUIRED",
  "READY_FOR_ACTION",
  "AWAITING_USER_APPROVAL",
  "ACTION_IN_PROGRESS",
  "WAITING_FOR_RESPONSE",
  "FOLLOW_UP_REQUIRED",
  "ESCALATION_AVAILABLE",
];

/**
 * Allowed status transitions. A case may always be closed by its owner, and a
 * closed case may be reopened, but RESOLVED is only reachable with explicit
 * user confirmation — enforced in the service layer (§65).
 */
const TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["INTAKE", "INFORMATION_REQUIRED", "INVESTIGATING", "CLOSED"],
  INTAKE: ["INFORMATION_REQUIRED", "INVESTIGATING", "READY_FOR_ACTION", "CLOSED"],
  INVESTIGATING: ["INFORMATION_REQUIRED", "READY_FOR_ACTION", "FOLLOW_UP_REQUIRED", "CLOSED"],
  INFORMATION_REQUIRED: ["INTAKE", "INVESTIGATING", "READY_FOR_ACTION", "CLOSED"],
  READY_FOR_ACTION: [
    "AWAITING_USER_APPROVAL",
    "ACTION_IN_PROGRESS",
    "INFORMATION_REQUIRED",
    "INVESTIGATING",
    "WAITING_FOR_RESPONSE",
    // "Not yet" must always be an answer the user can give, whatever the state.
    "FOLLOW_UP_REQUIRED",
    "RESOLVED",
    "CLOSED",
  ],
  AWAITING_USER_APPROVAL: [
    "ACTION_IN_PROGRESS",
    "READY_FOR_ACTION",
    "INFORMATION_REQUIRED",
    "FOLLOW_UP_REQUIRED",
    "CLOSED",
  ],
  ACTION_IN_PROGRESS: ["WAITING_FOR_RESPONSE", "FOLLOW_UP_REQUIRED", "READY_FOR_ACTION", "RESOLVED", "CLOSED"],
  WAITING_FOR_RESPONSE: ["FOLLOW_UP_REQUIRED", "ESCALATION_AVAILABLE", "READY_FOR_ACTION", "RESOLVED", "CLOSED"],
  FOLLOW_UP_REQUIRED: ["READY_FOR_ACTION", "ESCALATION_AVAILABLE", "WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"],
  ESCALATION_AVAILABLE: ["READY_FOR_ACTION", "ACTION_IN_PROGRESS", "WAITING_FOR_RESPONSE", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "FOLLOW_UP_REQUIRED"],
  CLOSED: ["INTAKE", "INVESTIGATING", "FOLLOW_UP_REQUIRED"],
};

export function isOpen(status: CaseStatus): boolean {
  return OPEN_STATES.includes(status);
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: CaseStatus): CaseStatus[] {
  return TRANSITIONS[from];
}

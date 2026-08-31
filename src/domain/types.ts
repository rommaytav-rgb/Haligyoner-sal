/**
 * Core domain model for Fix My Problem.
 *
 * The Case — not the chat transcript — is the source of truth. Every fact,
 * piece of evidence, research finding and action is a first-class record that
 * can be inspected, corrected and audited by the user.
 */

export type Timestamp = string; // ISO-8601 UTC

export type CaseStatus =
  | "NEW"
  | "INTAKE"
  | "INVESTIGATING"
  | "INFORMATION_REQUIRED"
  | "READY_FOR_ACTION"
  | "AWAITING_USER_APPROVAL"
  | "ACTION_IN_PROGRESS"
  | "WAITING_FOR_RESPONSE"
  | "FOLLOW_UP_REQUIRED"
  | "ESCALATION_AVAILABLE"
  | "RESOLVED"
  | "CLOSED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type FactVerification =
  | "USER_REPORTED"
  | "DOCUMENT_VERIFIED"
  | "SYSTEM_VERIFIED"
  | "EXTERNAL_SOURCE"
  | "INFERRED"
  | "UNKNOWN";

export interface Party {
  id: string;
  name: string;
  role: "COMPANY" | "PERSON" | "AUTHORITY" | "OTHER";
  contactHint?: string;
}

export interface UnknownItem {
  id: string;
  question: string;
  /** Why this matters — shown to the user as "Why I'm asking". */
  reason: string;
  importance: "REQUIRED" | "HELPFUL";
  resolved: boolean;
  answer?: string;
  createdAt: Timestamp;
}

export interface Fact {
  id: string;
  caseId: string;
  statement: string;
  verification: FactVerification;
  confidence: Confidence;
  sourceEvidenceId?: string;
  sourceUrl?: string;
  createdAt: Timestamp;
}

export type EvidenceType = "IMAGE" | "PDF" | "DOCUMENT" | "SCREENSHOT" | "TEXT";
export type EvidenceProcessingStatus = "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";

export interface Evidence {
  id: string;
  caseId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  extractedText?: string;
  /** Set when extraction was attempted but no capability existed for this type. */
  extractionNote?: string;
  evidenceType: EvidenceType;
  processingStatus: EvidenceProcessingStatus;
  relatedFactIds: string[];
  createdAt: Timestamp;
}

export type TimelineSource = "USER" | "DOCUMENT" | "SYSTEM" | "EXTERNAL" | "AI_INFERENCE";

export interface TimelineEvent {
  id: string;
  caseId: string;
  date?: Timestamp;
  title: string;
  description: string;
  source: TimelineSource;
  createdAt: Timestamp;
}

export type ActionType = "INFORMATION" | "RECOMMENDATION" | "DRAFT" | "EXTERNAL_ACTION";

export type ActionStatus =
  | "PENDING"
  | "REQUIRES_APPROVAL"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/**
 * Delivery state of an external action. Kept separate from ActionStatus so the
 * UI can never imply something was sent when only a draft exists (§25).
 */
export type DeliveryState =
  | "DRAFTED"
  | "APPROVED"
  | "IN_PROGRESS"
  | "SENT"
  | "DELIVERED"
  | "RESPONSE_RECEIVED"
  | "FAILED"
  | "UNKNOWN";

export interface ActionStep {
  id: string;
  caseId: string;
  order: number;
  title: string;
  description: string;
  type: ActionType;
  status: ActionStatus;
  requiresApproval: boolean;
  toolName?: string;
  /** True when the action names a capability that is not connected yet. */
  toolAvailable?: boolean;
  deliveryState?: DeliveryState;
  draft?: ActionDraft;
  dependsOn?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ActionDraft {
  channel: "EMAIL" | "LETTER" | "FORM" | "MESSAGE";
  recipient?: string;
  subject?: string;
  body: string;
  /** Exactly what leaves the user's control if they approve. */
  sharedInformation: string[];
  editedByUser?: boolean;
}

export interface Task {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt?: Timestamp;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  assignedTo: "USER" | "AI";
  createdAt: Timestamp;
}

export type ResearchSourceType = "OFFICIAL" | "GOVERNMENT" | "REGULATOR" | "POLICY" | "SECONDARY";

export interface ResearchItem {
  id: string;
  caseId: string;
  question: string;
  finding: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceType: ResearchSourceType;
  confidence: Confidence;
  retrievedAt: Timestamp;
}

export interface Case {
  id: string;
  userId: string;

  title: string;
  summary: string;
  originalProblem: string;
  userGoal?: string;

  primaryCategory?: string;
  secondaryCategories?: string[];

  status: CaseStatus;
  riskLevel: RiskLevel;
  /** Plain-language note about why this case is treated as it is. */
  riskNote?: string;

  involvedParties: Party[];
  unknowns: UnknownItem[];

  currentNextAction?: string;

  parentCaseId?: string;
  childCaseIds?: string[];

  /** Set when the user was asked to confirm resolution. */
  resolutionConfirmedByUser?: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM_NOTE";

export interface CaseMessage {
  id: string;
  caseId: string;
  role: MessageRole;
  content: string;
  /** Structured changes this turn made to the Case, for transparency. */
  appliedChanges?: string[];
  createdAt: Timestamp;
}

export type NotificationKind =
  | "INFORMATION_REQUIRED"
  | "APPROVAL_REQUIRED"
  | "DEADLINE"
  | "FOLLOW_UP"
  | "NEW_RESPONSE"
  | "STATUS_CHANGE";

export interface Notification {
  id: string;
  userId: string;
  caseId?: string;
  kind: NotificationKind;
  title: string;
  body: string;
  readAt?: Timestamp;
  createdAt: Timestamp;
}

export type AuditEventType =
  | "CASE_CREATED"
  | "CASE_UPDATED"
  | "FACT_ADDED"
  | "FACT_REMOVED"
  | "EVIDENCE_UPLOADED"
  | "EVIDENCE_PROCESSED"
  | "RESEARCH_COMPLETED"
  | "PLAN_CREATED"
  | "ACTION_DRAFTED"
  | "USER_APPROVED_ACTION"
  | "ACTION_EXECUTED"
  | "ACTION_CANCELLED"
  | "RESPONSE_RECEIVED"
  | "STATUS_CHANGED"
  | "AUTH_FAILURE"
  | "ACCESS_DENIED";

export interface AuditEvent {
  id: string;
  userId?: string;
  caseId?: string;
  type: AuditEventType;
  detail: string;
  createdAt: Timestamp;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  /** Only set for the local credential provider; never for federated sign-in. */
  passwordHash?: string;
  createdAt: Timestamp;
}

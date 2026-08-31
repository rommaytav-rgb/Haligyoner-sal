import type {
  ActionStep,
  AuditEvent,
  Case,
  CaseMessage,
  Evidence,
  Fact,
  ResearchItem,
  Task,
  TimelineEvent,
} from "@/domain/types";

export interface CaseBundle {
  case: Case;
  facts: Fact[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  tasks: Task[];
  research: ResearchItem[];
  actions: ActionStep[];
  messages: CaseMessage[];
  activity: AuditEvent[];
}

export interface CaseCapabilities {
  aiModelBacked: boolean;
  aiLimitationNote?: string;
  webResearch: boolean;
}

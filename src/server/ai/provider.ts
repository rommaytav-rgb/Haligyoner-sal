import type { Case, CaseMessage, Fact, ResearchItem, UnknownItem, ActionStep, Evidence } from "@/domain/types";
import type { ActionPlan, CaseReply, DraftResult, EvidenceAnalysis, ProblemAnalysis } from "./schemas";

/**
 * The only context a model ever sees. Built deliberately rather than by dumping
 * the database, so prompts stay small, cheap and free of irrelevant personal
 * information (section 58).
 */
export interface CaseContext {
  caseRecord: Pick<
    Case,
    "id" | "title" | "summary" | "originalProblem" | "userGoal" | "primaryCategory" | "status" | "riskLevel"
  >;
  facts: Pick<Fact, "id" | "statement" | "verification" | "confidence">[];
  unknowns: Pick<UnknownItem, "id" | "question" | "reason" | "importance" | "resolved">[];
  evidence: Pick<Evidence, "id" | "fileName" | "evidenceType" | "processingStatus" | "extractedText">[];
  research: Pick<ResearchItem, "question" | "finding" | "sourceUrl" | "confidence">[];
  actions: Pick<ActionStep, "id" | "title" | "type" | "status">[];
  recentMessages: Pick<CaseMessage, "role" | "content">[];
}

export interface ProblemInput {
  problem: string;
  categoryHint?: string;
  locale?: string;
}

export interface EvidenceInput {
  fileName: string;
  mimeType: string;
  extractedText: string;
  context: CaseContext;
}

export interface ProviderQuality {
  /** True when a language model is actually behind these results. */
  modelBacked: boolean;
  /** Shown verbatim to the user when the provider is not model-backed. */
  limitationNote?: string;
}

/**
 * Model-provider abstraction. The Case Engine depends on this interface, never
 * on a specific vendor SDK (sections 55, 56).
 */
export interface AIProvider {
  readonly name: string;
  readonly quality: ProviderQuality;

  analyzeProblem(input: ProblemInput): Promise<ProblemAnalysis>;
  replyInCase(context: CaseContext, userMessage: string): Promise<CaseReply>;
  analyzeEvidence(input: EvidenceInput): Promise<EvidenceAnalysis>;
  generateActionPlan(context: CaseContext): Promise<ActionPlan>;
  draftCommunication(context: CaseContext, action: Pick<ActionStep, "title" | "description">): Promise<DraftResult>;
}

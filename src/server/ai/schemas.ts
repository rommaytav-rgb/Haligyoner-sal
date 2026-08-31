import { z } from "zod";

/**
 * Schemas for every structured model output. Nothing produced by a model is
 * written to a Case before it passes one of these (section 57).
 */

export const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const analysisFactSchema = z.object({
  statement: z.string().min(3).max(400),
  verification: z.enum(["USER_REPORTED", "DOCUMENT_VERIFIED", "INFERRED"]),
  confidence: confidenceSchema,
});

export const analysisQuestionSchema = z.object({
  question: z.string().min(3).max(300),
  reason: z.string().min(3).max(300),
  importance: z.enum(["REQUIRED", "HELPFUL"]),
});

const timelineEntrySchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(400).default(""),
});

export const problemAnalysisSchema = z.object({
  title: z.string().min(3).max(90),
  summary: z.string().min(10).max(600),
  userGoal: z.string().min(3).max(240),
  primaryCategory: z.string().min(2).max(40),
  secondaryCategories: z.array(z.string().max(40)).max(4).default([]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  involvedParties: z
    .array(z.object({ name: z.string().min(1).max(120), role: z.enum(["COMPANY", "PERSON", "AUTHORITY", "OTHER"]) }))
    .max(6)
    .default([]),
  facts: z.array(analysisFactSchema).max(12).default([]),
  questions: z.array(analysisQuestionSchema).max(3).default([]),
  timeline: z.array(timelineEntrySchema).max(8).default([]),
  /** One short paragraph, addressed to the user, in the product's voice. */
  reply: z.string().min(10).max(900),
  /** Present only when the source material tried to issue instructions. */
  injectionObserved: z.string().max(300).optional(),
});

export type ProblemAnalysis = z.infer<typeof problemAnalysisSchema>;

export const caseReplySchema = z.object({
  reply: z.string().min(5).max(1200),
  newFacts: z.array(analysisFactSchema).max(8).default([]),
  answeredUnknownIds: z.array(z.string().max(64)).max(8).default([]),
  newQuestions: z.array(analysisQuestionSchema).max(3).default([]),
  timeline: z.array(timelineEntrySchema).max(4).default([]),
  retractedFactIds: z.array(z.string().max(64)).max(8).default([]),
  suggestedStatus: z
    .enum([
      "INTAKE",
      "INVESTIGATING",
      "INFORMATION_REQUIRED",
      "READY_FOR_ACTION",
      "WAITING_FOR_RESPONSE",
      "FOLLOW_UP_REQUIRED",
    ])
    .optional(),
});

export type CaseReply = z.infer<typeof caseReplySchema>;

export const evidenceAnalysisSchema = z.object({
  documentSummary: z.string().min(5).max(600),
  facts: z.array(analysisFactSchema).max(10).default([]),
  timeline: z.array(timelineEntrySchema).max(6).default([]),
  contradictions: z
    .array(z.object({ description: z.string().max(400), relatedFactStatement: z.string().max(400) }))
    .max(5)
    .default([]),
  injectionObserved: z.string().max(300).optional(),
});

export type EvidenceAnalysis = z.infer<typeof evidenceAnalysisSchema>;

export const actionPlanSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().min(3).max(140),
        description: z.string().min(5).max(700),
        type: z.enum(["INFORMATION", "RECOMMENDATION", "DRAFT", "EXTERNAL_ACTION"]),
        requiresApproval: z.boolean(),
      }),
    )
    .min(1)
    .max(8),
  nextAction: z.string().min(3).max(200),
});

export type ActionPlan = z.infer<typeof actionPlanSchema>;

export const draftSchema = z.object({
  channel: z.enum(["EMAIL", "LETTER", "FORM", "MESSAGE"]),
  recipient: z.string().max(160).optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(20).max(6000),
  sharedInformation: z.array(z.string().max(160)).max(12).default([]),
});

export type DraftResult = z.infer<typeof draftSchema>;

export const researchAnalysisSchema = z.object({
  findings: z
    .array(
      z.object({
        question: z.string().min(3).max(300),
        finding: z.string().min(5).max(900),
        sourceTitle: z.string().max(200).optional(),
        sourceUrl: z.string().max(500).optional(),
        sourceType: z.enum(["OFFICIAL", "GOVERNMENT", "REGULATOR", "POLICY", "SECONDARY"]),
        confidence: confidenceSchema,
      }),
    )
    .max(6)
    .default([]),
});

export type ResearchAnalysis = z.infer<typeof researchAnalysisSchema>;

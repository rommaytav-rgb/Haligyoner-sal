/**
 * JSON schemas handed to Gemini's structured-output mode. They mirror the zod
 * schemas in ./schemas.ts, which remain the authority: whatever comes back is
 * still validated before it reaches a Case.
 */

const factItem = {
  type: "object",
  properties: {
    statement: { type: "string" },
    verification: { type: "string", enum: ["USER_REPORTED", "DOCUMENT_VERIFIED", "INFERRED"] },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
  },
  required: ["statement", "verification", "confidence"],
} as const;

const questionItem = {
  type: "object",
  properties: {
    question: { type: "string" },
    reason: { type: "string" },
    importance: { type: "string", enum: ["REQUIRED", "HELPFUL"] },
  },
  required: ["question", "reason", "importance"],
} as const;

const timelineItem = {
  type: "object",
  properties: { title: { type: "string" }, description: { type: "string" } },
  required: ["title", "description"],
} as const;

export const problemAnalysisResponseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    userGoal: { type: "string" },
    primaryCategory: { type: "string" },
    secondaryCategories: { type: "array", items: { type: "string" } },
    riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    involvedParties: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string", enum: ["COMPANY", "PERSON", "AUTHORITY", "OTHER"] },
        },
        required: ["name", "role"],
      },
    },
    facts: { type: "array", items: factItem },
    questions: { type: "array", items: questionItem },
    timeline: { type: "array", items: timelineItem },
    reply: { type: "string" },
    injectionObserved: { type: "string" },
  },
  required: ["title", "summary", "userGoal", "primaryCategory", "riskLevel", "facts", "questions", "reply"],
} as const;

export const caseReplyResponseSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    newFacts: { type: "array", items: factItem },
    answeredUnknownIds: { type: "array", items: { type: "string" } },
    newQuestions: { type: "array", items: questionItem },
    timeline: { type: "array", items: timelineItem },
    retractedFactIds: { type: "array", items: { type: "string" } },
    suggestedStatus: {
      type: "string",
      enum: [
        "INTAKE",
        "INVESTIGATING",
        "INFORMATION_REQUIRED",
        "READY_FOR_ACTION",
        "WAITING_FOR_RESPONSE",
        "FOLLOW_UP_REQUIRED",
      ],
    },
  },
  required: ["reply"],
} as const;

export const evidenceAnalysisResponseSchema = {
  type: "object",
  properties: {
    documentSummary: { type: "string" },
    facts: { type: "array", items: factItem },
    timeline: { type: "array", items: timelineItem },
    contradictions: {
      type: "array",
      items: {
        type: "object",
        properties: { description: { type: "string" }, relatedFactStatement: { type: "string" } },
        required: ["description", "relatedFactStatement"],
      },
    },
    injectionObserved: { type: "string" },
  },
  required: ["documentSummary", "facts"],
} as const;

export const actionPlanResponseSchema = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: ["INFORMATION", "RECOMMENDATION", "DRAFT", "EXTERNAL_ACTION"] },
          requiresApproval: { type: "boolean" },
        },
        required: ["title", "description", "type", "requiresApproval"],
      },
    },
    nextAction: { type: "string" },
  },
  required: ["steps", "nextAction"],
} as const;

export const draftResponseSchema = {
  type: "object",
  properties: {
    channel: { type: "string", enum: ["EMAIL", "LETTER", "FORM", "MESSAGE"] },
    recipient: { type: "string" },
    subject: { type: "string" },
    body: { type: "string" },
    sharedInformation: { type: "array", items: { type: "string" } },
  },
  required: ["channel", "body", "sharedInformation"],
} as const;

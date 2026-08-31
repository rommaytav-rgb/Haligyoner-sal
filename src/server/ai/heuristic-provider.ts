import { classifyRisk } from "@/domain/risk";
import { normalizeCategory } from "@/domain/taxonomy";
import type { AIProvider, CaseContext, EvidenceInput, ProblemInput, ProviderQuality } from "./provider";
import type { ActionPlan, CaseReply, DraftResult, EvidenceAnalysis, ProblemAnalysis } from "./schemas";
import { detectInjection } from "./sanitize";

/**
 * A deterministic, rule-based provider used when no model is configured.
 *
 * It genuinely structures the problem — it splits the account into discrete
 * claims, classifies the category and risk, and asks the questions that
 * materially change the options. What it does *not* do is reason, and it says
 * so: `quality.modelBacked` is false and the UI surfaces the limitation rather
 * than passing rule output off as understanding (section 51).
 */
export class HeuristicProvider implements AIProvider {
  readonly name = "rule-based";
  readonly quality: ProviderQuality = {
    modelBacked: false,
    limitationNote:
      "AI understanding isn't connected on this deployment, so we've organised your problem using built-in rules. " +
      "Everything below is structured from your own words - nothing has been inferred beyond them.",
  };

  async analyzeProblem(input: ProblemInput): Promise<ProblemAnalysis> {
    const text = input.problem.trim();
    const claims = splitClaims(text);
    const category = input.categoryHint ? normalizeCategory(input.categoryHint) : detectCategory(text);
    const risk = classifyRisk(text);
    const parties = detectParties(text);
    const goal = detectGoal(text);

    const questions = buildQuestions(text, category);
    const injection = detectInjection(text);

    return {
      title: buildTitle(text, category),
      summary: claims.length > 1 ? `${claims[0]} ${claims.slice(1, 3).join(" ")}`.trim() : text.slice(0, 400),
      userGoal: goal,
      primaryCategory: category,
      secondaryCategories: [],
      riskLevel: risk.level,
      involvedParties: parties,
      facts: claims.slice(0, 8).map((statement) => ({
        statement,
        verification: "USER_REPORTED" as const,
        confidence: "MEDIUM" as const,
      })),
      questions,
      timeline: [{ title: "You told us what happened", description: claims[0] ?? text.slice(0, 200) }],
      reply: buildReply(questions),
      injectionObserved: injection.length
        ? "Your description contains text that reads like an instruction. We've treated it as part of your account, not as a command."
        : undefined,
    };
  }

  async replyInCase(context: CaseContext, userMessage: string): Promise<CaseReply> {
    const claims = splitClaims(userMessage);
    const openUnknowns = context.unknowns.filter((u) => !u.resolved);
    const answered = openUnknowns.filter((u) => looksLikeAnswerTo(u.question, userMessage)).map((u) => u.id);
    const correcting = /that'?s not|not what happened|wrong|actually,|correction/i.test(userMessage);

    const remaining = openUnknowns.filter((u) => !answered.includes(u.id));
    const reply = correcting
      ? "Understood - we've noted your correction and kept it against the case. Nothing is set in stone here."
      : answered.length > 0
        ? `Thanks, that's recorded.${remaining.length ? ` Next: ${remaining[0].question}` : " We'll fold that into your plan."}`
        : remaining.length > 0
          ? `Noted and added to your case. ${remaining[0].question}`
          : "Noted and added to your case.";

    return {
      reply,
      newFacts: claims.slice(0, 4).map((statement) => ({
        statement,
        verification: "USER_REPORTED" as const,
        confidence: "MEDIUM" as const,
      })),
      answeredUnknownIds: answered,
      newQuestions: [],
      timeline: [],
      retractedFactIds: [],
      suggestedStatus: remaining.length > 0 ? "INFORMATION_REQUIRED" : "READY_FOR_ACTION",
    };
  }

  async analyzeEvidence(input: EvidenceInput): Promise<EvidenceAnalysis> {
    const text = input.extractedText.trim();
    const injection = detectInjection(text);
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 12);

    // Only surface lines that carry a recognisable data point. Anything else
    // stays as raw text the user can read for themselves.
    const interesting = lines.filter((l) => /\d/.test(l)).slice(0, 6);

    return {
      documentSummary: text
        ? `${input.fileName} contains ${lines.length} lines of readable text. We've extracted it in full and attached it to the case.`
        : `We stored ${input.fileName}, but no text could be read from it here.`,
      facts: interesting.map((statement) => ({
        statement: statement.slice(0, 300),
        verification: "DOCUMENT_VERIFIED" as const,
        confidence: "MEDIUM" as const,
      })),
      timeline: [],
      contradictions: [],
      injectionObserved: injection.length
        ? "This document contains text that reads like an instruction to an assistant. We've ignored it and treated the file as evidence only."
        : undefined,
    };
  }

  async generateActionPlan(context: CaseContext): Promise<ActionPlan> {
    const open = context.unknowns.filter((u) => !u.resolved);
    const hasEvidence = context.evidence.length > 0;
    const company = context.caseRecord.summary.match(/\b(?:from|with|at)\s+([A-Z][\w&.-]{2,})/)?.[1];

    const steps: ActionPlan["steps"] = [];

    if (open.length > 0) {
      steps.push({
        title: `Fill in ${open.length === 1 ? "one missing detail" : `${open.length} missing details`}`,
        description: open.map((u) => `${u.question} (${u.reason})`).join("\n"),
        type: "INFORMATION",
        requiresApproval: false,
      });
    }

    if (!hasEvidence) {
      steps.push({
        title: "Gather your paperwork",
        description:
          "Upload anything you already have - receipts, order confirmations, screenshots, or messages you've exchanged. " +
          "Documents let us treat details as verified rather than as your account alone.",
        type: "INFORMATION",
        requiresApproval: false,
      });
    }

    steps.push({
      title: "Put the situation in writing",
      description:
        `We'll prepare a clear, factual message${company ? ` to ${company}` : ""} setting out what happened, what you've ` +
        "already done, and what you're asking for. You'll see it in full and approve it before anything is sent.",
      type: "DRAFT",
      requiresApproval: true,
    });

    steps.push({
      title: "Set a follow-up date",
      description:
        "If there's no reply within a reasonable window, we'll remind you and lay out what escalation options exist.",
      type: "RECOMMENDATION",
      requiresApproval: false,
    });

    return { steps, nextAction: steps[0].title };
  }

  async draftCommunication(
    context: CaseContext,
    _action: Pick<ActionPlan["steps"][number], "title" | "description">,
  ): Promise<DraftResult> {
    const c = context.caseRecord;
    const reported = context.facts.filter((f) => f.verification !== "INFERRED").slice(0, 8);

    // A truncated case title carries an ellipsis; it reads badly mid-sentence.
    const subject = c.title.replace(/\.{3}$/, "").trim();

    const body = [
      "Hello,",
      "",
      `I'm writing about the following: ${subject}.`,
      "",
      "What happened:",
      ...reported.map((f) => `- ${f.statement}`),
      "",
      `What I'm asking for: ${c.userGoal ?? "a resolution to this issue"}.`,
      "",
      "I'd appreciate a written response confirming how you intend to resolve this, and by when.",
      "",
      "Thank you,",
    ].join("\n");

    return {
      channel: "EMAIL",
      subject,
      body,
      sharedInformation: [
        "Your account of what happened",
        ...(reported.some((f) => /\d/.test(f.statement)) ? ["Reference numbers and amounts you provided"] : []),
      ],
    };
  }
}

const CATEGORY_SIGNALS: Array<[string, RegExp]> = [
  ["Payments", /\b(charge|charged|payment|card|bank|transaction|direct debit|invoice|billed|billing)\b/i],
  ["Delivery", /\b(parcel|package|delivery|courier|shipment|tracking|never arrived|shipping)\b/i],
  ["Travel", /\b(flight|airline|hotel|booking|cancelled flight|baggage|luggage|train|boarding)\b/i],
  ["Shopping", /\b(bought|purchase|order|retailer|store|product|item|refund|return|warranty)\b/i],
  ["Subscriptions", /\b(subscription|membership|auto-renew|renewal|cancel my plan|free trial)\b/i],
  ["Telecom", /\b(phone bill|mobile|broadband|internet provider|sim|data plan|router)\b/i],
  ["Utilities", /\b(electricity|gas bill|water bill|energy|meter reading|utility)\b/i],
  ["Housing", /\b(landlord|tenant|rent|deposit|lease|apartment|flat|eviction)\b/i],
  ["Insurance", /\b(insurance|insurer|policy|claim|premium|excess|deductible)\b/i],
  ["Employment", /\b(employer|salary|wages|payslip|contract of employment|dismissed|fired|overtime)\b/i],
  ["Government", /\b(council|government|agency|benefits|licence|permit|tax office)\b/i],
  ["Documents", /\b(document|letter|notice|form|certificate|paperwork|received a letter)\b/i],
  ["Technology", /\b(software|account locked|hacked|app|website|login|password reset)\b/i],
  ["Transportation", /\b(car|vehicle|garage|mechanic|parking|fine|ticket)\b/i],
  ["Education", /\b(university|school|course|tuition|student)\b/i],
];

function detectCategory(text: string): string {
  for (const [category, pattern] of CATEGORY_SIGNALS) {
    if (pattern.test(text)) return category;
  }
  return "Other";
}

/** Splits an account into individual claims so each can be verified separately. */
export function splitClaims(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 8)
    .map((s) => (s.endsWith(".") || s.endsWith("!") || s.endsWith("?") ? s : `${s}.`));
}

function buildTitle(text: string, category: string): string {
  const first = splitClaims(text)[0] ?? text;
  const trimmed = first.replace(/^(hi|hello|hey)[,!.\s]+/i, "").replace(/[.!?]+$/, "");
  const short = trimmed.length > 70 ? `${trimmed.slice(0, 67).trimEnd()}...` : trimmed;
  return short.length >= 8 ? capitalize(short) : `${category} problem`;
}

function detectGoal(text: string): string {
  if (/\brefund|money back|reimburse/i.test(text)) return "Get a refund";
  if (/\breplace|replacement|exchange\b/i.test(text)) return "Get a replacement";
  if (/\bcancel|stop the (charge|payment|subscription)/i.test(text)) return "Cancel and stop further charges";
  if (/\bcompensat|claim\b/i.test(text)) return "Get compensation";
  if (/\bexplain|understand|what does.*mean|don'?t understand/i.test(text)) return "Understand what this means and what to do";
  if (/\bdeliver|arrive|receive\b/i.test(text)) return "Receive what was ordered, or get the money back";
  if (/\breply|respond|answer|ignoring me/i.test(text)) return "Get a response and a resolution";
  return "Move this to a resolution";
}

function detectParties(text: string): ProblemAnalysis["involvedParties"] {
  const matches = [...text.matchAll(/\b(?:from|with|at|by|against)\s+([A-Z][A-Za-z0-9&.'-]{2,24})/g)]
    .map((m) => m[1])
    .filter((name) => !/^(I|The|My|A|An|It|They|We|This|That)$/i.test(name));

  return [...new Set(matches)].slice(0, 3).map((name) => ({ name, role: "COMPANY" as const }));
}

function buildQuestions(text: string, category: string): ProblemAnalysis["questions"] {
  const questions: ProblemAnalysis["questions"] = [];
  const has = (p: RegExp) => p.test(text);

  if (!has(/\b(yesterday|today|last week|last month|on \w+day|\d{1,2}[/-]\d{1,2}|\d{4}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i)) {
    questions.push({
      question: "When did this happen?",
      reason: "Your options often depend on how long ago it was - many refund and dispute windows are time-limited.",
      importance: "REQUIRED",
    });
  }

  if (category === "Payments" && !has(/\b(\$|£|€|\d+\.\d{2})/)) {
    questions.push({
      question: "How much were you charged, and by whom?",
      reason: "The amount and the merchant name are what a bank needs to open a dispute.",
      importance: "REQUIRED",
    });
  } else if (!has(/\b(order|reference|booking|invoice|account)\s*(number|no|#|id)/i)) {
    questions.push({
      question: "Do you have an order, booking or reference number?",
      reason: "A reference number is usually the first thing the other side asks for, and it speeds everything up.",
      importance: questions.length === 0 ? "REQUIRED" : "HELPFUL",
    });
  }

  if (questions.length < 3) {
    questions.push({
      question: "Have you contacted them about this already, and what did they say?",
      reason: "What you've already tried decides whether the next step is a first request or an escalation.",
      importance: "HELPFUL",
    });
  }

  return questions.slice(0, 3);
}

function buildReply(questions: ProblemAnalysis["questions"]): string {
  if (questions.length === 0) {
    return "We've organised what you told us into a case. Have a look at what we captured and correct anything that's off.";
  }
  return `We've organised what you told us into a case. To work out your options, we need ${
    questions.length === 1 ? "one thing" : `${questions.length} things`
  }. ${questions[0].question}`;
}

/**
 * Decides whether a message plausibly answers an open question. Deliberately
 * conservative for the details that matter (dates, amounts, references) and
 * more forgiving for open-ended ones, so a question is never asked twice after
 * the person has clearly addressed it.
 */
function looksLikeAnswerTo(question: string, message: string): boolean {
  const q = question.toLowerCase();

  if (/\bwhen\b|\bdate\b/.test(q)) {
    return /\b(yesterday|today|last|ago|this (week|month)|\d{1,2}[/-]\d{1,2}|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(
      message,
    );
  }
  if (/\bnumber\b|\bhow much\b|\bamount\b|\breference\b/.test(q)) {
    return /\d/.test(message);
  }
  if (/^(have|did|do|are|is|was|were|has)\b/.test(q) || /\balready\b/.test(q)) {
    // A yes/no question is answered by any substantive reply that engages with it.
    return /\b(yes|no|not yet|never|i (have|did|didn'?t|haven'?t)|emailed|called|wrote|contacted|spoke)\b/i.test(message);
  }
  // Anything else: a reply of real substance counts as having addressed it.
  return message.trim().split(/\s+/).length >= 8;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

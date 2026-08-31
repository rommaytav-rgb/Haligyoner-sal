import { classifyRisk } from "@/domain/risk";
import { normalizeCategory } from "@/domain/taxonomy";
import { caseText } from "@/server/i18n";
import type { Locale } from "@/i18n/config";
import type { AIProvider, CaseContext, EvidenceInput, ProblemInput, ProviderQuality } from "./provider";
import type { ActionPlan, CaseReply, DraftResult, EvidenceAnalysis, ProblemAnalysis } from "./schemas";
import { detectInjection } from "./sanitize";
import { caseLocale, detectLanguage } from "./language";

/**
 * A deterministic, rule-based provider used when no model is configured.
 *
 * It genuinely structures the problem - it splits the account into discrete
 * claims, classifies the category and risk, and asks the questions that
 * materially change the options. What it does *not* do is reason, and it says
 * so: `quality.modelBacked` is false and the UI surfaces the limitation rather
 * than passing rule output off as understanding.
 *
 * Every rule here is bilingual. A problem written in Hebrew is classified by
 * Hebrew signals and answered in Hebrew, because the language of a case follows
 * the person who wrote it.
 */
export class HeuristicProvider implements AIProvider {
  readonly name = "rule-based";
  readonly quality: ProviderQuality = { modelBacked: false, limitationKey: "ai.ruleBasedNote" };

  async analyzeProblem(input: ProblemInput): Promise<ProblemAnalysis> {
    const text = input.problem.trim();
    const locale = detectLanguage(text);
    const t = (key: string, params?: Record<string, string | number>) => caseText(key, params, locale);

    const claims = splitClaims(text);
    const category = input.categoryHint ? normalizeCategory(input.categoryHint) : detectCategory(text);
    const risk = classifyRisk(text);
    const questions = buildQuestions(text, category, t);

    return {
      title: buildTitle(text, category, locale, t),
      summary: claims.length > 1 ? `${claims[0]} ${claims.slice(1, 3).join(" ")}`.trim() : text.slice(0, 400),
      userGoal: detectGoal(text, t),
      primaryCategory: category,
      secondaryCategories: [],
      riskLevel: risk.level,
      involvedParties: detectParties(text, locale),
      facts: claims.slice(0, 8).map((statement) => ({
        statement,
        verification: "USER_REPORTED" as const,
        confidence: "MEDIUM" as const,
      })),
      questions,
      timeline: [{ title: t("agent.openedTimeline"), description: claims[0] ?? text.slice(0, 200) }],
      reply: buildReply(questions, locale, t),
      injectionObserved: detectInjection(text).length
        ? t("unavailable.injectionInProblem")
        : undefined,
    };
  }

  async replyInCase(context: CaseContext, userMessage: string): Promise<CaseReply> {
    // The case keeps the language it was opened in, so a follow-up written in
    // the other language still gets an answer consistent with the case.
    const locale = caseLocale(context.caseRecord.contentLocale, detectLanguage(userMessage));
    const t = (key: string, params?: Record<string, string | number>) => caseText(key, params, locale);

    const claims = splitClaims(userMessage);
    const openUnknowns = context.unknowns.filter((u) => !u.resolved);
    const answered = openUnknowns.filter((u) => looksLikeAnswerTo(u.question, userMessage)).map((u) => u.id);
    const correcting = CORRECTION_SIGNALS.some((pattern) => pattern.test(userMessage));

    const remaining = openUnknowns.filter((u) => !answered.includes(u.id));
    const blocking = remaining.filter((u) => u.importance === "REQUIRED");

    const reply = correcting
      ? t("agent.correctionAck")
      : answered.length > 0
        ? remaining.length > 0
          ? t("agent.recordedNext", { question: remaining[0].question })
          : t("agent.recordedDone")
        : remaining.length > 0
          ? t("agent.notedNext", { question: remaining[0].question })
          : t("agent.noted");

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
      suggestedStatus: blocking.length > 0 ? "INFORMATION_REQUIRED" : "READY_FOR_ACTION",
    };
  }

  async analyzeEvidence(input: EvidenceInput): Promise<EvidenceAnalysis> {
    const locale = caseLocale(input.context.caseRecord.contentLocale);
    const t = (key: string, params?: Record<string, string | number>) => caseText(key, params, locale);

    const text = input.extractedText.trim();
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 12);

    // Only surface lines that carry a recognisable data point. Anything else
    // stays as raw text the user can read for themselves.
    const interesting = lines.filter((line) => /\d/.test(line)).slice(0, 6);

    return {
      documentSummary: text
        ? t("agent.documentRead", { fileName: input.fileName, lines: lines.length })
        : t("agent.documentUnreadable", { fileName: input.fileName }),
      facts: interesting.map((statement) => ({
        statement: statement.slice(0, 300),
        verification: "DOCUMENT_VERIFIED" as const,
        confidence: "MEDIUM" as const,
      })),
      timeline: [],
      contradictions: [],
      injectionObserved: detectInjection(text).length ? t("unavailable.injectionInDocument") : undefined,
    };
  }

  async generateActionPlan(context: CaseContext): Promise<ActionPlan> {
    const locale = caseLocale(context.caseRecord.contentLocale);
    const t = (key: string, params?: Record<string, string | number>) => caseText(key, params, locale);

    const open = context.unknowns.filter((u) => !u.resolved);
    const hasEvidence = context.evidence.length > 0;
    const steps: ActionPlan["steps"] = [];

    if (open.length > 0) {
      steps.push({
        title: open.length === 1 ? t("agent.stepFillTitleOne") : t("agent.stepFillTitleMany", { count: open.length }),
        description: open
          .map((u) => t("agent.stepFillLine", { question: u.question, reason: u.reason }))
          .join("\n"),
        type: "INFORMATION",
        requiresApproval: false,
      });
    }

    if (!hasEvidence) {
      steps.push({
        title: t("agent.stepGatherTitle"),
        description: t("agent.stepGatherBody"),
        type: "INFORMATION",
        requiresApproval: false,
      });
    }

    steps.push({
      title: t("agent.stepWriteTitle"),
      description: t("agent.stepWriteBody"),
      type: "DRAFT",
      requiresApproval: true,
    });

    steps.push({
      title: t("agent.stepFollowUpTitle"),
      description: t("agent.stepFollowUpBody"),
      type: "RECOMMENDATION",
      requiresApproval: false,
    });

    return { steps, nextAction: steps[0].title };
  }

  async draftCommunication(context: CaseContext): Promise<DraftResult> {
    const locale = caseLocale(context.caseRecord.contentLocale);
    const t = (key: string, params?: Record<string, string | number>) => caseText(key, params, locale);

    const record = context.caseRecord;
    const reported = context.facts.filter((f) => f.verification !== "INFERRED").slice(0, 8);
    // A truncated case title carries an ellipsis; it reads badly mid-sentence.
    const subject = record.title.replace(/\.{3}$/, "").trim();

    const body = [
      t("agent.draftGreeting"),
      "",
      t("agent.draftAbout", { subject }),
      "",
      t("agent.draftWhatHappened"),
      ...reported.map((f) => `- ${f.statement}`),
      "",
      t("agent.draftAsking", { goal: record.userGoal ?? t("agent.draftGoalFallback") }),
      "",
      t("agent.draftClosing"),
      "",
      t("agent.draftSignOff"),
    ].join("\n");

    return {
      channel: "EMAIL",
      subject,
      body,
      sharedInformation: [
        t("agent.sharedAccount"),
        ...(reported.some((f) => /\d/.test(f.statement)) ? [t("agent.sharedReferences")] : []),
      ],
    };
  }
}

type Text = (key: string, params?: Record<string, string | number>) => string;

/**
 * Category signals in both languages. English and Hebrew patterns sit side by
 * side so a Hebrew problem is classified as accurately as an English one.
 */
const CATEGORY_SIGNALS: Array<[string, RegExp]> = [
  [
    "Payments",
    /\b(charge|charged|payment|card|bank|transaction|direct debit|invoice|billed|billing)\b|(חיוב|חייבו|תשלום|כרטיס אשראי|בנק|עסקה|הוראת קבע|חשבונית|גבו)/i,
  ],
  [
    "Delivery",
    /\b(parcel|package|delivery|courier|shipment|tracking|never arrived|shipping)\b|(חבילה|משלוח|שליח|דואר שליחים|מעקב משלוח|לא הגיע)/i,
  ],
  [
    "Travel",
    /\b(flight|airline|hotel|booking|cancelled flight|baggage|luggage|train|boarding)\b|(טיסה|חברת תעופה|מלון|הזמנה|כבודה|מזוודה|רכבת|עלייה למטוס)/i,
  ],
  [
    "Shopping",
    /\b(bought|purchase|order|retailer|store|product|item|refund|return|warranty)\b|(קניתי|רכישה|הזמנה|חנות|מוצר|החזר|אחריות|החזרה)/i,
  ],
  [
    "Subscriptions",
    /\b(subscription|membership|auto-renew|renewal|cancel my plan|free trial)\b|(מנוי|חידוש אוטומטי|ביטול מנוי|תקופת ניסיון)/i,
  ],
  [
    "Telecom",
    /\b(phone bill|mobile|broadband|internet provider|sim|data plan|router)\b|(חשבון טלפון|סלולר|אינטרנט|ספק אינטרנט|סים|נתב|גלישה)/i,
  ],
  ["Utilities", /\b(electricity|gas bill|water bill|energy|meter reading|utility)\b|(חשמל|גז|מים|קריאת מונה|חברת החשמל)/i],
  ["Housing", /\b(landlord|tenant|rent|deposit|lease|apartment|flat|eviction)\b|(בעל הדירה|שוכר|שכירות|פיקדון|חוזה שכירות|דירה|פינוי)/i],
  ["Insurance", /\b(insurance|insurer|policy|claim|premium|excess|deductible)\b|(ביטוח|חברת הביטוח|פוליסה|תביעה|פרמיה|השתתפות עצמית)/i],
  [
    "Employment",
    /\b(employer|salary|wages|payslip|contract of employment|dismissed|fired|overtime)\b|(מעסיק|משכורת|שכר|תלוש|חוזה עבודה|פוטרתי|שעות נוספות)/i,
  ],
  ["Government", /\b(council|government|agency|benefits|licence|permit|tax office)\b|(עירייה|רשות|ביטוח לאומי|רישיון|היתר|מס הכנסה)/i],
  ["Documents", /\b(document|letter|notice|form|certificate|paperwork|received a letter)\b|(מסמך|מכתב|הודעה|טופס|תעודה|ניירת)/i],
  ["Technology", /\b(software|account locked|hacked|app|website|login|password reset)\b|(תוכנה|חשבון נחסם|נפרצתי|אפליקציה|אתר|התחברות|איפוס סיסמה)/i],
  ["Transportation", /\b(car|vehicle|garage|mechanic|parking|fine|ticket)\b|(רכב|מוסך|מכונאי|חניה|קנס|דוח)/i],
  ["Education", /\b(university|school|course|tuition|student)\b|(אוניברסיטה|בית ספר|קורס|שכר לימוד|סטודנט)/i],
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
    .map((sentence) => sentence.trim().replace(/\s+/g, " "))
    .filter((sentence) => sentence.length > 8)
    .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`));
}

function buildTitle(text: string, category: string, locale: Locale, t: Text): string {
  const first = splitClaims(text)[0] ?? text;
  const trimmed = first.replace(/^(hi|hello|hey|שלום|היי)[,!.\s]+/i, "").replace(/[.!?]+$/, "");
  const short = trimmed.length > 70 ? `${trimmed.slice(0, 67).trimEnd()}...` : trimmed;

  if (short.length < 8) return t("agent.fallbackTitle", { category: t(`category.${category}`) });
  // Hebrew has no letter case, so only Latin titles are capitalised.
  return locale === "he" ? short : short.charAt(0).toUpperCase() + short.slice(1);
}

const GOAL_SIGNALS: Array<[string, RegExp]> = [
  ["agent.goalRefund", /\brefund|money back|reimburse\b|(החזר כספי|כסף בחזרה|לקבל את הכסף)/i],
  ["agent.goalReplacement", /\breplace|replacement|exchange\b|(להחליף|מוצר חלופי|החלפה)/i],
  ["agent.goalCancel", /\bcancel|stop the (charge|payment|subscription)\b|(לבטל|ביטול|להפסיק את החיוב)/i],
  ["agent.goalCompensation", /\bcompensat|claim\b|(פיצוי|לתבוע)/i],
  ["agent.goalUnderstand", /\bexplain|understand|what does.*mean|don'?t understand\b|(להבין|לא מבין|מה זה אומר|תסבירו)/i],
  ["agent.goalReceive", /\bdeliver|arrive|receive\b|(לקבל|שיגיע|למסור)/i],
  [
    "agent.goalResponse",
    /\breply|respond|answer|ignoring me\b|(תשובה|לא עונים|לא ענו|מתעלמים|לא חוזר|לא חוזרים|לא חזר|לא חזרו)/i,
  ],
];

function detectGoal(text: string, t: Text): string {
  for (const [key, pattern] of GOAL_SIGNALS) {
    if (pattern.test(text)) return t(key);
  }
  return t("agent.goalGeneric");
}

function detectParties(text: string, locale: Locale): ProblemAnalysis["involvedParties"] {
  // The capitalisation cue this relies on does not exist in Hebrew, so rather
  // than guess at company names we record none and let the user tell us.
  if (locale === "he") return [];

  const matches = [...text.matchAll(/\b(?:from|with|at|by|against)\s+([A-Z][A-Za-z0-9&.'-]{2,24})/g)]
    .map((match) => match[1])
    .filter((name) => !/^(I|The|My|A|An|It|They|We|This|That)$/i.test(name));

  return [...new Set(matches)].slice(0, 3).map((name) => ({ name, role: "COMPANY" as const }));
}

const HAS_DATE =
  /\b(yesterday|today|last week|last month|on \w+day|\d{1,2}[/-]\d{1,2}|\d{4}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))|(אתמול|היום|שלשום|לפני שבוע|לפני חודש|בינואר|בפברואר|במרץ|באפריל|במאי|ביוני|ביולי|באוגוסט|בספטמבר|באוקטובר|בנובמבר|בדצמבר|\d{1,2}[/.]\d{1,2})/i;
const HAS_AMOUNT = /[$£€₪]|\d+\.\d{2}|\d+\s?(שקל|ש"ח|שקלים)/i;
const HAS_REFERENCE =
  /\b(order|reference|booking|invoice|account)\s*(number|no|#|id)|(מספר|מס')\s*(הזמנה|אסמכתא|חשבונית|לקוח|הזמנת)/i;

function buildQuestions(text: string, category: string, t: Text): ProblemAnalysis["questions"] {
  const questions: ProblemAnalysis["questions"] = [];

  if (!HAS_DATE.test(text)) {
    questions.push({
      question: t("agent.askWhen"),
      reason: t("agent.askWhenReason"),
      importance: "REQUIRED",
    });
  }

  if (category === "Payments" && !HAS_AMOUNT.test(text)) {
    questions.push({
      question: t("agent.askAmount"),
      reason: t("agent.askAmountReason"),
      importance: "REQUIRED",
    });
  } else if (!HAS_REFERENCE.test(text)) {
    questions.push({
      question: t("agent.askReference"),
      reason: t("agent.askReferenceReason"),
      importance: questions.length === 0 ? "REQUIRED" : "HELPFUL",
    });
  }

  if (questions.length < 3) {
    questions.push({
      question: t("agent.askContacted"),
      reason: t("agent.askContactedReason"),
      importance: "HELPFUL",
    });
  }

  return questions.slice(0, 3);
}

function buildReply(questions: ProblemAnalysis["questions"], locale: Locale, t: Text): string {
  if (questions.length === 0) return t("agent.introNoQuestions");
  if (questions.length === 1) return t("agent.introOne", { question: questions[0].question });
  return t("agent.introMany", { count: questions.length, question: questions[0].question });
}

const CORRECTION_SIGNALS = [
  /that'?s not|not what happened|wrong|actually,|correction/i,
  /(זה לא נכון|לא זה מה שקרה|טעות|בעצם|תיקון|לא מדויק)/,
];

const YES_NO_ANSWER =
  /\b(yes|no|not yet|never|i (have|did|didn'?t|haven'?t)|emailed|called|wrote|contacted|spoke)\b|(כן|לא|עדיין לא|מעולם לא|שלחתי|התקשרתי|כתבתי|פניתי|דיברתי)/i;
const DATE_ANSWER =
  /\b(yesterday|today|last|ago|\d{1,2}[/-]\d{1,2}|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(אתמול|היום|שלשום|לפני|בתאריך|\d{1,2}[/.]\d{1,2}|\d{4})/i;

/**
 * Decides whether a message plausibly answers an open question. Deliberately
 * conservative for the details that matter (dates, amounts, references) and
 * more forgiving for open-ended ones, so a question is never asked twice after
 * the person has clearly addressed it.
 */
function looksLikeAnswerTo(question: string, message: string): boolean {
  const asksWhen = /\bwhen\b|\bdate\b/i.test(question) || /מתי/.test(question);
  const asksNumber = /\b(number|how much|amount|reference)\b/i.test(question) || /(מספר|בכמה|סכום|אסמכתא)/.test(question);
  const asksYesNo = /^(have|did|do|are|is|was|were|has)\b/i.test(question) || /(כבר|האם)/.test(question);

  if (asksWhen) return DATE_ANSWER.test(message);
  if (asksNumber) return /\d/.test(message);
  if (asksYesNo) return YES_NO_ANSWER.test(message);

  // Anything else: a reply of real substance counts as having addressed it.
  return message.trim().split(/\s+/).length >= 8;
}

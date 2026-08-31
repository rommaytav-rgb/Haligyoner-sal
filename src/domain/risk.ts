import type { RiskLevel } from "./types";

/**
 * Baseline risk classification. The AI provider may raise this, but the rules
 * here set a floor: sensitive domains are never quietly downgraded (§26).
 */
const HIGH_RISK_SIGNALS = [
  "lawsuit", "sue", "court", "subpoena", "eviction", "deportation", "immigration",
  "visa", "asylum", "criminal", "police", "arrest", "custody", "divorce",
  "medical", "diagnosis", "prescription", "surgery", "hospital", "malpractice",
  "tax", "irs", "hmrc", "audit", "bankruptcy", "foreclosure", "repossession",
  "wage garnishment", "restraining order", "self-harm", "abuse", "threat",
  "safety", "gas leak", "carbon monoxide", "electrical fire",
];

const MEDIUM_RISK_SIGNALS = [
  "refund", "chargeback", "dispute", "cancel", "cancellation", "billing",
  "overcharge", "unauthorized", "fraud", "complaint", "warranty", "return",
  "deposit", "compensation", "claim", "insurance", "contract", "fee",
  "late fee", "debt", "collection",
];

export interface RiskAssessment {
  level: RiskLevel;
  note: string;
  /** Domains where the product must not present itself as a licensed professional. */
  requiresProfessionalDisclaimer: boolean;
}

export function classifyRisk(text: string): RiskAssessment {
  const haystack = text.toLowerCase();

  const high = HIGH_RISK_SIGNALS.filter((s) => haystack.includes(s));
  if (high.length > 0) {
    return {
      level: "HIGH",
      note:
        "This touches an area where the stakes are high and the rules are specific. " +
        "We can help you organise it and understand your options, but we're not a substitute for a qualified professional.",
      requiresProfessionalDisclaimer: true,
    };
  }

  const medium = MEDIUM_RISK_SIGNALS.filter((s) => haystack.includes(s));
  if (medium.length > 0) {
    return {
      level: "MEDIUM",
      note: "This involves money or a formal dispute, so we'll check the details with you before anything is sent.",
      requiresProfessionalDisclaimer: false,
    };
  }

  return {
    level: "LOW",
    note: "This looks like something we can work through by organising the details and preparing what you need.",
    requiresProfessionalDisclaimer: false,
  };
}

/** Risk never decreases below the rule-based floor, whatever a model suggests. */
export function combineRisk(floor: RiskLevel, suggested: RiskLevel | undefined): RiskLevel {
  const rank: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  if (!suggested) return floor;
  return rank[suggested] > rank[floor] ? suggested : floor;
}

/**
 * Whether an action may be executed without a human in the loop. The answer is
 * currently "never" for anything leaving the system — kept as a function so the
 * policy has one place to live.
 */
export function automationAllowed(risk: RiskLevel, actionType: string): boolean {
  if (actionType === "EXTERNAL_ACTION") return false;
  return risk !== "HIGH";
}

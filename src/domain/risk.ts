import type { RiskLevel } from "./types";

/**
 * Baseline risk classification. The AI provider may raise this, but the rules
 * here set a floor: sensitive domains are never quietly downgraded (§26).
 */
/**
 * Signals that put a problem in a sensitive domain.
 *
 * Bilingual by necessity, not convenience: an English-only list would quietly
 * classify a Hebrew court summons as low risk and let the product speak with a
 * confidence it has not earned. The floor has to hold in every language the
 * product accepts.
 */
const HIGH_RISK_SIGNALS = [
  // English
  "lawsuit", "sue", "court", "subpoena", "eviction", "deportation", "immigration",
  "visa", "asylum", "criminal", "police", "arrest", "custody", "divorce",
  "medical", "diagnosis", "prescription", "surgery", "hospital", "malpractice",
  "tax", "irs", "hmrc", "audit", "bankruptcy", "foreclosure", "repossession",
  "wage garnishment", "restraining order", "self-harm", "abuse", "threat",
  "safety", "gas leak", "carbon monoxide", "electrical fire",
  // Hebrew
  "תביעה", "לתבוע", "בית משפט", "בית המשפט", "זימון לדין", "זימון לבית משפט",
  "הוצאה לפועל", "עיקול", "פינוי", "גירוש", "הגירה", "ויזה", "אשרה", "מקלט",
  "פלילי", "משטרה", "מעצר", "משמורת", "גירושין", "עורך דין",
  "רפואי", "אבחנה", "מרשם", "ניתוח", "בית חולים", "רשלנות רפואית",
  "מס הכנסה", "מע\"מ", "שומה", "פשיטת רגל", "כינוס נכסים",
  "עיקול משכורת", "צו הרחקה", "פגיעה עצמית", "התעללות", "איום",
  "בטיחות", "דליפת גז", "שריפה", "חשמל מסוכן",
];

const MEDIUM_RISK_SIGNALS = [
  // English
  "refund", "chargeback", "dispute", "cancel", "cancellation", "billing",
  "overcharge", "unauthorized", "fraud", "complaint", "warranty", "return",
  "deposit", "compensation", "claim", "insurance", "contract", "fee",
  "late fee", "debt", "collection",
  // Hebrew
  "החזר", "החזר כספי", "ביטול עסקה", "מחלוקת", "לבטל", "ביטול", "חיוב",
  "חיוב יתר", "לא מורשה", "הונאה", "תלונה", "אחריות", "החזרה",
  "פיקדון", "פיצוי", "תביעת ביטוח", "ביטוח", "חוזה", "עמלה",
  "ריבית פיגורים", "חוב", "גבייה",
];

export interface RiskAssessment {
  level: RiskLevel;
  /** Catalogue key for the plain-language note shown on the case. */
  noteKey: string;
  /** Domains where the product must not present itself as a licensed professional. */
  requiresProfessionalDisclaimer: boolean;
}

export function classifyRisk(text: string): RiskAssessment {
  const haystack = text.toLowerCase();

  const high = HIGH_RISK_SIGNALS.filter((s) => haystack.includes(s));
  if (high.length > 0) {
    return { level: "HIGH", noteKey: "risk.high", requiresProfessionalDisclaimer: true };
  }

  const medium = MEDIUM_RISK_SIGNALS.filter((s) => haystack.includes(s));
  if (medium.length > 0) {
    return { level: "MEDIUM", noteKey: "risk.medium", requiresProfessionalDisclaimer: false };
  }

  return { level: "LOW", noteKey: "risk.low", requiresProfessionalDisclaimer: false };
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

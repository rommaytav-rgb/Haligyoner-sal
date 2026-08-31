/**
 * A flexible taxonomy — deliberately not a hard-coded switch over categories.
 * Unknown problems are valid and must still produce a useful workflow (§33).
 */
export const CATEGORIES = [
  "Consumer",
  "Shopping",
  "Payments",
  "Travel",
  "Housing",
  "Utilities",
  "Telecom",
  "Employment",
  "Education",
  "Insurance",
  "Government",
  "Documents",
  "Subscriptions",
  "Transportation",
  "Delivery",
  "Technology",
  "Personal Administration",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function normalizeCategory(input: string | undefined | null): string {
  if (!input) return "Other";
  const match = CATEGORIES.find((c) => c.toLowerCase() === input.trim().toLowerCase());
  // An unrecognised category is kept as a free-form label rather than discarded,
  // so the taxonomy can grow without a migration.
  const custom = input.trim().slice(0, 40);
  return match ?? (custom.length > 0 ? custom : "Other");
}

export interface QuickStart {
  id: string;
  emoji: string;
  label: string;
  /** Seeds the composer; the user is never forced into a category. */
  prompt: string;
}

export const QUICK_STARTS: QuickStart[] = [
  { id: "money", emoji: "💳", label: "Money & Charges", prompt: "I was charged " },
  { id: "orders", emoji: "📦", label: "Orders & Deliveries", prompt: "I ordered " },
  { id: "travel", emoji: "✈️", label: "Travel", prompt: "My flight " },
  { id: "services", emoji: "📱", label: "Services & Subscriptions", prompt: "I'm being billed for a subscription " },
  { id: "documents", emoji: "📄", label: "Documents", prompt: "I received a document " },
  { id: "other", emoji: "💬", label: "Something else", prompt: "" },
];

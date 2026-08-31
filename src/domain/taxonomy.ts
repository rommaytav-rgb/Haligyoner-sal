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

/**
 * Quick-start shortcuts. They carry no display text: the label and the seed
 * phrase live in the string catalogue, so the same shortcut works in every
 * language. `category` is a canonical taxonomy value, not a label, so the hint
 * survives translation and passes server-side validation.
 */
export interface QuickStart {
  id: string;
  emoji: string;
  category?: Category;
}

export const QUICK_STARTS: QuickStart[] = [
  { id: "money", emoji: "💳", category: "Payments" },
  { id: "orders", emoji: "📦", category: "Delivery" },
  { id: "travel", emoji: "✈️", category: "Travel" },
  { id: "services", emoji: "📱", category: "Subscriptions" },
  { id: "documents", emoji: "📄", category: "Documents" },
  { id: "other", emoji: "💬" },
];

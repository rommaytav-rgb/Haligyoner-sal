/**
 * A minimal document-store contract. It is deliberately close to Firestore's
 * shape so the Firestore adapter is thin, while staying small enough that a
 * local adapter can implement it faithfully for development and tests.
 */

export type Primitive = string | number | boolean | null;

export interface Filter {
  field: string;
  op: "==" | "in" | "!=";
  value: Primitive | Primitive[];
}

export interface QueryOptions {
  orderBy?: { field: string; direction: "asc" | "desc" };
  limit?: number;
}

export interface HasId {
  id: string;
}

export interface DocumentStore {
  get<T extends HasId>(collection: string, id: string): Promise<T | null>;
  put<T extends HasId>(collection: string, doc: T): Promise<T>;
  patch<T extends HasId>(collection: string, id: string, partial: Partial<T>): Promise<T>;
  remove(collection: string, id: string): Promise<void>;
  query<T extends HasId>(collection: string, filters: Filter[], options?: QueryOptions): Promise<T[]>;
  /** Test/support hook; not part of the request path. */
  reset?(): Promise<void>;
}

export const COLLECTIONS = {
  users: "users",
  cases: "cases",
  facts: "facts",
  evidence: "evidence",
  timelineEvents: "timelineEvents",
  tasks: "tasks",
  research: "research",
  actions: "actions",
  notifications: "notifications",
  messages: "messages",
  audit: "audit",
} as const;

export function matches(doc: Record<string, unknown>, filters: Filter[]): boolean {
  return filters.every((f) => {
    const value = doc[f.field];
    if (f.op === "==") return value === f.value;
    if (f.op === "!=") return value !== f.value;
    return Array.isArray(f.value) && (f.value as Primitive[]).includes(value as Primitive);
  });
}

export function sortDocs<T extends Record<string, unknown>>(docs: T[], options?: QueryOptions): T[] {
  if (!options?.orderBy) return docs;
  const { field, direction } = options.orderBy;
  const sorted = [...docs].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    return av < bv ? -1 : 1;
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

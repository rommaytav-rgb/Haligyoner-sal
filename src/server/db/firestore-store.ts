import type { DocumentStore, Filter, HasId, QueryOptions } from "./store";
import { notFound } from "@/lib/errors";
import { config } from "@/lib/config";

type FirestoreLike = {
  collection: (name: string) => {
    doc: (id: string) => {
      get: () => Promise<{ exists: boolean; data: () => unknown }>;
      set: (data: unknown) => Promise<unknown>;
      update: (data: unknown) => Promise<unknown>;
      delete: () => Promise<unknown>;
    };
    where: (field: string, op: string, value: unknown) => unknown;
    orderBy: (field: string, dir: string) => unknown;
    limit: (n: number) => unknown;
    get: () => Promise<{ docs: { data: () => unknown }[] }>;
  };
};

/**
 * Firestore adapter. Authorisation is *not* delegated to Firestore rules — every
 * read here is already scoped by an ownership filter applied server-side, so a
 * misconfigured rule set cannot leak another user's case (§18).
 */
export class FirestoreStore implements DocumentStore {
  private db: FirestoreLike | null = null;

  private async client(): Promise<FirestoreLike> {
    if (this.db) return this.db;
    const { getApps, initializeApp, applicationDefault, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");

    const app =
      getApps()[0] ??
      initializeApp({
        projectId: config.gcpProjectId,
        credential: config.firebaseServiceAccount
          ? cert(JSON.parse(config.firebaseServiceAccount))
          : applicationDefault(),
      });

    const db = getFirestore(app) as unknown as FirestoreLike;
    this.db = db;
    return db;
  }

  async get<T extends HasId>(collection: string, id: string): Promise<T | null> {
    const db = await this.client();
    const snap = await db.collection(collection).doc(id).get();
    return snap.exists ? (snap.data() as T) : null;
  }

  async put<T extends HasId>(collection: string, doc: T): Promise<T> {
    const db = await this.client();
    await db.collection(collection).doc(doc.id).set(stripUndefined(doc));
    return doc;
  }

  async patch<T extends HasId>(collection: string, id: string, partial: Partial<T>): Promise<T> {
    const db = await this.client();
    const ref = db.collection(collection).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw notFound();
    await ref.update(stripUndefined(partial));
    const updated = await ref.get();
    return updated.data() as T;
  }

  async remove(collection: string, id: string): Promise<void> {
    const db = await this.client();
    await db.collection(collection).doc(id).delete();
  }

  async query<T extends HasId>(collection: string, filters: Filter[], options?: QueryOptions): Promise<T[]> {
    const db = await this.client();
    let q: unknown = db.collection(collection);
    for (const f of filters) {
      q = (q as { where: (a: string, b: string, c: unknown) => unknown }).where(f.field, f.op, f.value);
    }
    if (options?.orderBy) {
      q = (q as { orderBy: (a: string, b: string) => unknown }).orderBy(options.orderBy.field, options.orderBy.direction);
    }
    if (options?.limit) {
      q = (q as { limit: (n: number) => unknown }).limit(options.limit);
    }
    const snap = await (q as { get: () => Promise<{ docs: { data: () => unknown }[] }> }).get();
    return snap.docs.map((d) => d.data() as T);
  }
}

/** Firestore rejects `undefined`; optional domain fields are simply omitted. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

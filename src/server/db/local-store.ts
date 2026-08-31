import { promises as fs } from "node:fs";
import path from "node:path";
import { COLLECTIONS, matches, sortDocs, type DocumentStore, type Filter, type HasId, type QueryOptions } from "./store";
import { notFound } from "@/lib/errors";

type Collection = Map<string, Record<string, unknown>>;

/**
 * Local document store used when no Firestore project is configured. Data is
 * held in memory and, when a directory is supplied, mirrored to JSON on disk so
 * a development session survives a restart. Writes are serialised through a
 * promise chain so concurrent requests cannot interleave a read-modify-write.
 */
export class LocalStore implements DocumentStore {
  private readonly data = new Map<string, Collection>();
  private readonly dir?: string;
  private loaded = false;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(dir?: string) {
    this.dir = dir;
  }

  private collection(name: string): Collection {
    let c = this.data.get(name);
    if (!c) {
      c = new Map();
      this.data.set(name, c);
    }
    return c;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.dir) return;
    await fs.mkdir(this.dir, { recursive: true });
    for (const name of Object.values(COLLECTIONS)) {
      try {
        const raw = await fs.readFile(path.join(this.dir, `${name}.json`), "utf8");
        const parsed = JSON.parse(raw) as Record<string, unknown>[];
        const c = this.collection(name);
        for (const doc of parsed) c.set(String(doc.id), doc);
      } catch {
        // A missing file simply means the collection is empty.
      }
    }
  }

  private persist(name: string): void {
    if (!this.dir) return;
    const dir = this.dir;
    const snapshot = [...this.collection(name).values()];
    this.writeChain = this.writeChain
      .then(async () => {
        await fs.mkdir(dir, { recursive: true });
        const target = path.join(dir, `${name}.json`);
        const tmp = `${target}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
        await fs.rename(tmp, target);
      })
      .catch(() => {
        // Persistence is best-effort in local mode; in-memory state stays correct.
      });
  }

  /** Awaits any queued disk writes — used by tests and graceful shutdown. */
  async flush(): Promise<void> {
    await this.writeChain;
  }

  async get<T extends HasId>(collection: string, id: string): Promise<T | null> {
    await this.load();
    const doc = this.collection(collection).get(id);
    return doc ? (structuredClone(doc) as T) : null;
  }

  async put<T extends HasId>(collection: string, doc: T): Promise<T> {
    await this.load();
    this.collection(collection).set(doc.id, structuredClone(doc) as Record<string, unknown>);
    this.persist(collection);
    return doc;
  }

  async patch<T extends HasId>(collection: string, id: string, partial: Partial<T>): Promise<T> {
    await this.load();
    const existing = this.collection(collection).get(id);
    if (!existing) throw notFound();
    const merged = { ...existing, ...structuredClone(partial) } as Record<string, unknown>;
    this.collection(collection).set(id, merged);
    this.persist(collection);
    return merged as T;
  }

  async remove(collection: string, id: string): Promise<void> {
    await this.load();
    this.collection(collection).delete(id);
    this.persist(collection);
  }

  async query<T extends HasId>(collection: string, filters: Filter[], options?: QueryOptions): Promise<T[]> {
    await this.load();
    const all = [...this.collection(collection).values()].filter((doc) => matches(doc, filters));
    const sorted = sortDocs(all, options);
    const limited = options?.limit ? sorted.slice(0, options.limit) : sorted;
    return structuredClone(limited) as T[];
  }

  async reset(): Promise<void> {
    this.data.clear();
    this.loaded = !this.dir;
  }
}

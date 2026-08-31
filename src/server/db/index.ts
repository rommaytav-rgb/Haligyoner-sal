import { config } from "@/lib/config";
import { LocalStore } from "./local-store";
import { FirestoreStore } from "./firestore-store";
import type { DocumentStore } from "./store";

let instance: DocumentStore | null = null;

/**
 * Chooses the persistence backend once per process. Firestore is used when the
 * deployment is configured for it; otherwise a local store keeps development and
 * tests fully functional without cloud credentials.
 */
export function getStore(): DocumentStore {
  if (!instance) {
    instance = config.useFirestore ? new FirestoreStore() : new LocalStore(config.localDataDir);
  }
  return instance;
}

/** Test hook: swap in a store with no ambient state. */
export function setStoreForTesting(store: DocumentStore | null): void {
  instance = store;
}

export * from "./store";

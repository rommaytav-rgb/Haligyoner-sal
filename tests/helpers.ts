import { LocalStore } from "@/server/db/local-store";
import { setStoreForTesting } from "@/server/db";
import { setAIProviderForTesting, HeuristicProvider } from "@/server/ai";
import { setStorageForTesting, type EvidenceStorage } from "@/server/storage";
import { resetRateLimits } from "@/server/http/rate-limit";
import { newId, now } from "@/domain/ids";
import { COLLECTIONS, getStore } from "@/server/db";
import type { User } from "@/domain/types";

/** In-memory storage so evidence tests never touch the filesystem. */
export class MemoryStorage implements EvidenceStorage {
  readonly kind = "local" as const;
  readonly files = new Map<string, Buffer>();

  async put(objectPath: string, data: Buffer) {
    this.files.set(objectPath, data);
    return { storagePath: objectPath, sizeBytes: data.byteLength };
  }
  async read(objectPath: string) {
    const file = this.files.get(objectPath);
    if (!file) throw new Error("not found");
    return file;
  }
  async remove(objectPath: string) {
    this.files.delete(objectPath);
  }
}

export function useCleanEnvironment(): { storage: MemoryStorage } {
  const storage = new MemoryStorage();
  setStoreForTesting(new LocalStore());
  setStorageForTesting(storage);
  setAIProviderForTesting(new HeuristicProvider());
  resetRateLimits();
  return { storage };
}

export async function createTestUser(email = `${Math.random().toString(36).slice(2)}@example.com`): Promise<User> {
  const user: User = { id: newId("usr"), email, createdAt: now() };
  await getStore().put(COLLECTIONS.users, user);
  return user;
}

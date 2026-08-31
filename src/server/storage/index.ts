import { promises as fs } from "node:fs";
import path from "node:path";
import { capabilities, config } from "@/lib/config";
import { AppError, invalid } from "@/lib/errors";
import { log } from "@/lib/logger";

export interface StoredObject {
  storagePath: string;
  sizeBytes: number;
}

export interface EvidenceStorage {
  readonly kind: "gcs" | "local";
  put(objectPath: string, data: Buffer, mimeType: string): Promise<StoredObject>;
  read(objectPath: string): Promise<Buffer>;
  remove(objectPath: string): Promise<void>;
}

/** Types we accept. Anything else is rejected before a byte is written (section 19). */
export const ALLOWED_MIME_TYPES: Record<string, "IMAGE" | "PDF" | "DOCUMENT" | "TEXT"> = {
  "image/png": "IMAGE",
  "image/jpeg": "IMAGE",
  "image/webp": "IMAGE",
  "image/heic": "IMAGE",
  "application/pdf": "PDF",
  "text/plain": "TEXT",
  "text/csv": "TEXT",
  "text/html": "TEXT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
};

export function validateUpload(fileName: string, mimeType: string, sizeBytes: number): void {
  if (!ALLOWED_MIME_TYPES[mimeType]) {
    throw invalid("errors.fileTypeUnsupported");
  }
  if (sizeBytes <= 0) throw invalid("errors.fileEmpty");
  if (sizeBytes > config.maxUploadBytes) {
    throw invalid("errors.fileTooLarge", { limit: Math.round(config.maxUploadBytes / (1024 * 1024)) });
  }
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    throw invalid("errors.fileNameNotAllowed");
  }
}

/**
 * Local disk storage. Files live outside the served directory with owner-only
 * permissions, and are read back through an authorised route - never linked
 * directly (section 19).
 */
class LocalEvidenceStorage implements EvidenceStorage {
  readonly kind = "local" as const;
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root, "evidence");
  }

  private resolve(objectPath: string): string {
    const target = path.resolve(this.root, objectPath);
    // Defence in depth: a traversal in the object path must not escape the root.
    if (!target.startsWith(this.root + path.sep)) throw new AppError("FORBIDDEN", "errors.invalidFileLocation");
    return target;
  }

  async put(objectPath: string, data: Buffer): Promise<StoredObject> {
    const target = this.resolve(objectPath);
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await fs.writeFile(target, data, { mode: 0o600 });
    return { storagePath: objectPath, sizeBytes: data.byteLength };
  }

  async read(objectPath: string): Promise<Buffer> {
    return fs.readFile(this.resolve(objectPath));
  }

  async remove(objectPath: string): Promise<void> {
    await fs.rm(this.resolve(objectPath), { force: true });
  }
}

/** Cloud Storage. The bucket stays private; nothing is ever made public. */
class GcsEvidenceStorage implements EvidenceStorage {
  readonly kind = "gcs" as const;
  private bucket: ReturnType<typeof this.load> | null = null;

  private async load() {
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getStorage: getAdminStorage } = await import("firebase-admin/storage");
    const app = getApps()[0] ?? initializeApp({ projectId: config.gcpProjectId });
    return getAdminStorage(app).bucket(config.storageBucket);
  }

  private async getBucket() {
    if (!this.bucket) this.bucket = this.load();
    return this.bucket;
  }

  async put(objectPath: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const bucket = await this.getBucket();
    await bucket.file(objectPath).save(data, {
      contentType: mimeType,
      resumable: false,
      metadata: { cacheControl: "private, max-age=0, no-store" },
    });
    return { storagePath: objectPath, sizeBytes: data.byteLength };
  }

  async read(objectPath: string): Promise<Buffer> {
    const bucket = await this.getBucket();
    const [contents] = await bucket.file(objectPath).download();
    return contents;
  }

  async remove(objectPath: string): Promise<void> {
    const bucket = await this.getBucket();
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
  }
}

let storage: EvidenceStorage | null = null;

export function getStorage(): EvidenceStorage {
  if (!storage) {
    storage = capabilities.cloudStorage ? new GcsEvidenceStorage() : new LocalEvidenceStorage(config.localDataDir);
    log.info({ event: "storage.init", backend: storage.kind });
  }
  return storage;
}

export function setStorageForTesting(next: EvidenceStorage | null): void {
  storage = next;
}

/** Object paths are namespaced by user so a bucket listing cannot mix owners. */
export function evidenceObjectPath(userId: string, caseId: string, evidenceId: string, fileName: string): string {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  return `users/${userId}/cases/${caseId}/${evidenceId}-${safeName}`;
}

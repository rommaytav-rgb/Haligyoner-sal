import { COLLECTIONS, getStore } from "@/server/db";
import { newId, now } from "@/domain/ids";
import type { AuditEvent, AuditEventType } from "@/domain/types";
import { log } from "@/lib/logger";

/**
 * Append-only record of everything consequential (section 38). The detail field
 * holds identifiers and outcomes, never the user's problem text.
 */
export async function audit(
  type: AuditEventType,
  detail: string,
  scope: { userId?: string; caseId?: string } = {},
): Promise<void> {
  const event: AuditEvent = {
    id: newId("aud"),
    type,
    detail: detail.slice(0, 300),
    userId: scope.userId,
    caseId: scope.caseId,
    createdAt: now(),
  };
  try {
    await getStore().put(COLLECTIONS.audit, event);
  } catch (error) {
    // An audit failure must not take down the operation it describes.
    log.error({ event: "audit.write_failed", type, error });
  }
  log.info({ event: `audit.${type.toLowerCase()}`, userId: scope.userId, caseId: scope.caseId });
}

export async function listAuditForCase(caseId: string, limit = 50): Promise<AuditEvent[]> {
  return getStore().query<AuditEvent>(COLLECTIONS.audit, [{ field: "caseId", op: "==", value: caseId }], {
    orderBy: { field: "createdAt", direction: "desc" },
    limit,
  });
}

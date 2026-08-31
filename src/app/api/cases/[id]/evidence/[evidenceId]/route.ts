import { NextResponse } from "next/server";
import { idSchema } from "@/lib/validation";
import { COLLECTIONS, getStore } from "@/server/db";
import type { Evidence } from "@/domain/types";
import { getStorage } from "@/server/storage";
import { requireOwnedCase } from "@/server/services/cases";
import { requireUser } from "@/server/auth";
import { errorResponse } from "@/server/http/route";
import { notFound } from "@/lib/errors";

/**
 * The only way to read an uploaded file. Ownership is re-checked on every
 * request and the bytes are streamed through the app, so stored objects are
 * never publicly addressable (section 19).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string; evidenceId: string }> }) {
  try {
    const user = await requireUser();
    const { id, evidenceId } = await context.params;
    const caseId = idSchema.parse(id);
    await requireOwnedCase(user.id, caseId);

    const evidence = await getStore().get<Evidence>(COLLECTIONS.evidence, idSchema.parse(evidenceId));
    if (!evidence || evidence.caseId !== caseId || evidence.userId !== user.id) {
      throw notFound("errors.fileNotFound");
    }

    const bytes = await getStorage().read(evidence.storagePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": evidence.mimeType,
        // Always an attachment: never render user-supplied HTML in our origin.
        "Content-Disposition": `attachment; filename="${evidence.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; evidenceId: string }> }) {
  try {
    const user = await requireUser();
    const { id, evidenceId } = await context.params;
    const caseId = idSchema.parse(id);
    await requireOwnedCase(user.id, caseId);

    const evidence = await getStore().get<Evidence>(COLLECTIONS.evidence, idSchema.parse(evidenceId));
    if (!evidence || evidence.caseId !== caseId || evidence.userId !== user.id) {
      throw notFound("errors.fileNotFound");
    }

    await getStorage().remove(evidence.storagePath);
    await getStore().remove(COLLECTIONS.evidence, evidence.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, request);
  }
}

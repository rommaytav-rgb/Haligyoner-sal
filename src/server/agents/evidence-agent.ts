import { newId, now } from "@/domain/ids";
import { log } from "@/lib/logger";
import type { Evidence, EvidenceType } from "@/domain/types";
import { ALLOWED_MIME_TYPES, evidenceObjectPath, getStorage, validateUpload } from "@/server/storage";
import { COLLECTIONS, getStore } from "@/server/db";
import { extractDocumentText } from "@/server/tools";
import { getAIProvider } from "@/server/ai";
import { addFact, addTimelineEvent, buildCaseContext, requireOwnedCase } from "@/server/services/cases";
import { audit } from "@/server/services/audit";
import { resolveRecord, systemText } from "@/server/i18n";

export interface EvidenceResult {
  evidence: Evidence;
  factsAdded: number;
  contradictions: string[];
  /** Set when the file contained text that tried to issue instructions. */
  injectionObserved?: string;
}

/**
 * Evidence Agent (section 21).
 *
 * Stores the file privately, extracts what text it can, and connects what the
 * document itself states to the case as DOCUMENT_VERIFIED facts. Everything it
 * reads is treated as untrusted quoted material (section 28).
 */
export async function processEvidence(
  userId: string,
  caseId: string,
  file: { name: string; mimeType: string; data: Buffer },
): Promise<EvidenceResult> {
  const record = await requireOwnedCase(userId, caseId);
  validateUpload(file.name, file.mimeType, file.data.byteLength);

  const evidenceId = newId("evd");
  const objectPath = evidenceObjectPath(userId, caseId, evidenceId, file.name);
  const stored = await getStorage().put(objectPath, file.data, file.mimeType);

  const kind = ALLOWED_MIME_TYPES[file.mimeType];
  const evidenceType: EvidenceType =
    kind === "IMAGE" && /screenshot/i.test(file.name) ? "SCREENSHOT" : (kind as EvidenceType);

  let evidence: Evidence = {
    id: evidenceId,
    caseId,
    userId,
    fileName: file.name,
    mimeType: file.mimeType,
    sizeBytes: stored.sizeBytes,
    storagePath: stored.storagePath,
    evidenceType,
    processingStatus: "PROCESSING",
    relatedFactIds: [],
    createdAt: now(),
  };
  await getStore().put(COLLECTIONS.evidence, evidence);
  await audit("EVIDENCE_UPLOADED", `${file.mimeType} ${stored.sizeBytes}B`, { userId, caseId });

  const extraction = await extractDocumentText.run(
    { fileName: file.name, mimeType: file.mimeType, data: file.data } as never,
    { userId, caseId, riskLevel: record.riskLevel },
  );

  if (!extraction.ok) {
    evidence = await getStore().patch<Evidence>(COLLECTIONS.evidence, evidenceId, {
      processingStatus: "FAILED",
      ...noteFields(extraction.messageKey, extraction.messageParams),
    });
    return { evidence, factsAdded: 0, contradictions: [] };
  }

  const { text, noteKey, noteParams } = extraction.data as {
    text: string;
    noteKey?: string;
    noteParams?: Record<string, string | number>;
    suspicious: boolean;
  };

  if (!text.trim()) {
    evidence = await getStore().patch<Evidence>(COLLECTIONS.evidence, evidenceId, {
      processingStatus: "PROCESSED",
      ...noteFields(noteKey, noteParams),
    });
    await addTimelineEvent(caseId, {
      title: systemText("system.fileAdded", { fileName: file.name }),
      description: noteKey ? systemText(noteKey, noteParams) : systemText("system.fileStored"),
      source: "DOCUMENT",
    });
    return { evidence, factsAdded: 0, contradictions: [] };
  }

  let factsAdded = 0;
  let contradictions: string[] = [];
  let injectionObserved: string | undefined;

  try {
    const context = await buildCaseContext(caseId);
    const analysis = await getAIProvider().analyzeEvidence({
      fileName: file.name,
      mimeType: file.mimeType,
      extractedText: text,
      context,
    });

    const relatedFactIds: string[] = [];
    for (const fact of analysis.facts) {
      const created = await addFact(
        caseId,
        {
          statement: fact.statement,
          verification: fact.verification === "USER_REPORTED" ? "DOCUMENT_VERIFIED" : fact.verification,
          confidence: fact.confidence,
          sourceEvidenceId: evidenceId,
        },
        { userId },
      );
      relatedFactIds.push(created.id);
      factsAdded += 1;
    }

    for (const entry of analysis.timeline) {
      await addTimelineEvent(caseId, { title: entry.title, description: entry.description, source: "DOCUMENT" });
    }

    contradictions = analysis.contradictions.map((c) => c.description);
    injectionObserved = analysis.injectionObserved;

    evidence = await getStore().patch<Evidence>(COLLECTIONS.evidence, evidenceId, {
      processingStatus: "PROCESSED",
      extractedText: text.slice(0, 50_000),
      ...noteFields(noteKey, noteParams),
      relatedFactIds,
    });
    await audit("EVIDENCE_PROCESSED", `${factsAdded} facts`, { userId, caseId });
  } catch (error) {
    log.error({ event: "evidence.analysis_failed", caseId, error });
    // The file is safely stored; only the reading of it failed.
    evidence = await getStore().patch<Evidence>(COLLECTIONS.evidence, evidenceId, {
      processingStatus: "FAILED",
      extractedText: text.slice(0, 50_000),
      ...noteFields("unavailable.evidenceAnalysisFailed"),
    });
  }

  await addTimelineEvent(caseId, {
    title: systemText("system.fileAdded", { fileName: file.name }),
    description: factsAdded
      ? systemText("system.fileConfirmed", { count: factsAdded }, factsAdded)
      : systemText("system.fileStored"),
    source: "DOCUMENT",
  });

  return { evidence, factsAdded, contradictions, injectionObserved };
}

/**
 * Builds the stored note for a file we could not fully read: a catalogue
 * reference for display, plus a rendered fallback that keeps the record legible
 * on its own.
 */
function noteFields(key?: string, params?: Record<string, string | number>) {
  if (!key) return {};
  const record = resolveRecord(systemText(key, params));
  return { extractionNote: record.text, extractionNoteText: record.ref };
}

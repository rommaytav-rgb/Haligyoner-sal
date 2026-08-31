import { ALLOWED_MIME_TYPES } from "@/server/storage";
import { detectInjection } from "@/server/ai/sanitize";
import type { Tool } from "./types";
import { unavailableTool } from "./types";

export interface ExtractionResult {
  text: string;
  /** Catalogue key explaining why nothing could be read, when that happens. */
  noteKey?: string;
  noteParams?: Record<string, string | number>;
  suspicious: boolean;
}

const TEXT_TYPES = new Set(["text/plain", "text/csv", "text/html"]);

/**
 * Text extraction. Plain-text formats are read directly. PDFs, images and Word
 * documents need a document-understanding service (Document AI or a multimodal
 * model); until one is connected the file is stored and the limitation is
 * recorded on the evidence itself rather than silently ignored (section 51).
 */
export const extractDocumentText: Tool<{ fileName: string; mimeType: string; data: Buffer }, ExtractionResult> = {
  name: "extractDocumentText",
  descriptionKey: "tools.extractDocumentText.description",
  available: true,
  requiresApproval: false,
  async run({ fileName, mimeType, data }) {
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return { ok: false, reason: "NOT_PERMITTED", messageKey: "errors.fileTypeUnsupported" };
    }

    if (TEXT_TYPES.has(mimeType)) {
      let text = data.toString("utf8");
      if (mimeType === "text/html") {
        const { htmlToText } = await import("./web");
        text = htmlToText(text);
      }
      return { ok: true, data: { text: text.slice(0, 100_000), suspicious: detectInjection(text).length > 0 } };
    }

    const kind = ALLOWED_MIME_TYPES[mimeType];
    const noteKey =
      kind === "IMAGE" ? "unavailable.imageText" : kind === "PDF" ? "unavailable.pdfText" : "unavailable.wordText";

    return {
      ok: true,
      data: { text: "", suspicious: false, noteKey, noteParams: { fileName } },
    };
  },
};

export const analyzeImage = unavailableTool<{ evidenceId: string }, { description: string }>(
  "analyzeImage",
  "tools.analyzeImage.unavailable",
  undefined,
  false,
);

export const compareDocuments: Tool<{ left: string; right: string }, { differences: string[] }> = {
  name: "compareDocuments",
  descriptionKey: "tools.compareDocuments.description",
  available: true,
  requiresApproval: false,
  async run({ left, right }) {
    const leftLines = new Set(normalize(left));
    const rightLines = normalize(right);
    const differences = rightLines.filter((line) => !leftLines.has(line)).slice(0, 20);
    return { ok: true, data: { differences } };
  },
};

function normalize(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter((l) => l.length > 10);
}

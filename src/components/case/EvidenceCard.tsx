import type { Evidence } from "@/domain/types";
import { Badge } from "@/components/ui/Badge";
import { formatBytes, relativeTime } from "@/lib/format";

const ICONS: Record<Evidence["evidenceType"], string> = {
  IMAGE: "🖼️",
  SCREENSHOT: "🖼️",
  PDF: "📄",
  DOCUMENT: "📄",
  TEXT: "📝",
};

export function EvidenceCard({ item, caseId, onRemove }: { item: Evidence; caseId: string; onRemove?: () => void }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="text-lg" aria-hidden="true">
          {ICONS[item.evidenceType]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{item.fileName}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            {formatBytes(item.sizeBytes)} &middot; added {relativeTime(item.createdAt)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.processingStatus === "PROCESSED" && item.relatedFactIds.length > 0 && (
              <Badge tone="ok">Confirmed {item.relatedFactIds.length} detail(s)</Badge>
            )}
            {item.processingStatus === "PROCESSING" && <Badge tone="info">Reading it</Badge>}
            {item.processingStatus === "FAILED" && <Badge tone="warn">Couldn&rsquo;t read it</Badge>}
          </div>

          {item.extractionNote && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">{item.extractionNote}</p>
          )}

          <div className="mt-3 flex items-center gap-3 text-[13px]">
            <a
              href={`/api/cases/${caseId}/evidence/${item.id}`}
              className="font-medium text-ink underline underline-offset-4 hover:text-ink-soft"
            >
              Download
            </a>
            {onRemove && (
              <button onClick={onRemove} className="text-ink-mute hover:text-signal-risk">
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

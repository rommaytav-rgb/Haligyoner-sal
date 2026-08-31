"use client";

import type { Evidence } from "@/domain/types";
import { Badge } from "@/components/ui/Badge";
import { formatBytes } from "@/i18n/format";
import { useI18n } from "@/i18n/client";

const ICONS: Record<Evidence["evidenceType"], string> = {
  IMAGE: "🖼️",
  SCREENSHOT: "🖼️",
  PDF: "📄",
  DOCUMENT: "📄",
  TEXT: "📝",
};

export function EvidenceCard({ item, caseId, onRemove }: { item: Evidence; caseId: string; onRemove?: () => void }) {
  const { t, locale, relativeTime } = useI18n();

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="text-lg" aria-hidden="true">
          {ICONS[item.evidenceType]}
        </span>
        <div className="min-w-0 flex-1">
          {/* A file name is a literal; isolate it so its punctuation doesn't
              reorder inside a right-to-left paragraph. */}
          <p dir="auto" className="truncate text-[14px] font-medium text-ink bidi-isolate">
            {item.fileName}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-faint">
            {formatBytes(item.sizeBytes, locale)} &middot; {t("evidence.added", { time: relativeTime(item.createdAt) })}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.processingStatus === "PROCESSED" && item.relatedFactIds.length > 0 && (
              <Badge tone="ok">{t.plural("evidence.confirmedBadge", item.relatedFactIds.length)}</Badge>
            )}
            {item.processingStatus === "PROCESSING" && <Badge tone="info">{t("evidence.processing")}</Badge>}
            {item.processingStatus === "FAILED" && <Badge tone="warn">{t("evidence.unreadable")}</Badge>}
          </div>

          {item.extractionNote && (
            <p dir="auto" className="mt-2 text-[13px] leading-relaxed text-ink-mute">
              {item.extractionNote}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3 text-[13px]">
            <a
              href={`/api/cases/${caseId}/evidence/${item.id}`}
              className="font-medium text-ink underline underline-offset-4 hover:text-ink-soft"
            >
              {t("common.download")}
            </a>
            {onRemove && (
              <button onClick={onRemove} className="text-ink-mute hover:text-signal-risk">
                {t("common.remove")}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

"use client";

import Link from "next/link";
import type { Case } from "@/domain/types";
import { CASE_STATUS_TONE } from "@/domain/status";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/client";

export function CaseCard({ record }: { record: Case }) {
  const { t, relativeTime } = useI18n();
  const resolved = record.status === "RESOLVED";

  return (
    <Link
      href={`/cases/${record.id}`}
      className="group block rounded-2xl border border-line bg-white p-5 shadow-card transition-all hover:border-line-strong hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Case titles carry the language the case was written in, which need
            not match the interface, so each one declares its own direction. */}
        <h3 dir="auto" className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {record.title}
        </h3>
        <Badge tone={CASE_STATUS_TONE[record.status]} dot={!resolved}>
          {t(`status.${record.status}`)}
        </Badge>
      </div>

      {record.currentNextAction && !resolved && (
        <p className="mt-2.5 line-clamp-2 text-[14px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">{t("cases.nextPrefix")} </span>
          <span dir="auto" className="bidi-isolate">
            {record.currentNextAction}
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint">
        {record.primaryCategory && <span>{t(`category.${record.primaryCategory}`)}</span>}
        {record.primaryCategory && <span aria-hidden="true">&middot;</span>}
        <span>{t("cases.updated", { time: relativeTime(record.updatedAt) })}</span>
        {record.riskLevel === "HIGH" && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="text-signal-warn">{t("cases.sensitive")}</span>
          </>
        )}
      </div>
    </Link>
  );
}

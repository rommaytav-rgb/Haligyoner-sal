"use client";

import * as React from "react";
import type { ResearchItem } from "@/domain/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CapabilityNotice, EmptyState, LoadingState } from "@/components/ui/States";
import { useI18n } from "@/i18n/client";

const TONE: Record<ResearchItem["sourceType"], BadgeTone> = {
  OFFICIAL: "ok",
  GOVERNMENT: "ok",
  REGULATOR: "info",
  POLICY: "info",
  SECONDARY: "neutral",
};

const CONFIDENCE_KEY: Record<ResearchItem["confidence"], string> = {
  HIGH: "research.confidenceHigh",
  MEDIUM: "research.confidenceMedium",
  LOW: "research.confidenceLow",
};

export function ResearchPanel({
  research,
  available,
  running,
  unavailableReason,
  onRun,
}: {
  research: ResearchItem[];
  available: boolean;
  running: boolean;
  unavailableReason?: string;
  onRun: () => void;
}) {
  const { t, relativeTime } = useI18n();

  if (!available) {
    return (
      <div className="space-y-4">
        <CapabilityNotice>{unavailableReason ?? t("research.unavailableBody")}</CapabilityNotice>
        {research.length === 0 && (
          <div className="rounded-2xl border border-line bg-white shadow-card">
            <EmptyState title={t("research.unavailableTitle")} body={t("research.unavailableBody")} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-mute">{t("research.intro")}</p>
        <Button size="sm" variant="secondary" onClick={onRun} loading={running}>
          {research.length > 0 ? t("research.runAgain") : t("research.run")}
        </Button>
      </div>

      {running && <LoadingState message={t("research.running")} />}

      {research.length === 0 && !running ? (
        <div className="mt-4 rounded-2xl border border-line bg-white shadow-card">
          <EmptyState title={t("research.emptyTitle")} body={t("research.emptyBody")} />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {research.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <p dir="auto" className="text-[13px] font-medium text-ink-mute">
                {item.question}
              </p>
              <p dir="auto" className="mt-2 text-[14.5px] leading-relaxed text-ink">
                {item.finding}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={TONE[item.sourceType]}>{t(`sourceType.${item.sourceType}`)}</Badge>
                <Badge tone={item.confidence === "HIGH" ? "ok" : item.confidence === "MEDIUM" ? "neutral" : "warn"}>
                  {t(CONFIDENCE_KEY[item.confidence])}
                </Badge>
                <span className="text-[12.5px] text-ink-faint">
                  {t("research.found", { time: relativeTime(item.retrievedAt) })}
                </span>
              </div>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  dir="ltr"
                  className="mt-2 inline-block break-all text-start text-[13px] text-ink underline underline-offset-4 hover:text-ink-soft"
                >
                  {item.sourceTitle ?? item.sourceUrl}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

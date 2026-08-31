"use client";

import * as React from "react";
import type { ResearchItem } from "@/domain/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CapabilityNotice, EmptyState, LoadingState } from "@/components/ui/States";
import { relativeTime } from "@/lib/format";

const TONE: Record<ResearchItem["sourceType"], BadgeTone> = {
  OFFICIAL: "ok",
  GOVERNMENT: "ok",
  REGULATOR: "info",
  POLICY: "info",
  SECONDARY: "neutral",
};

const LABEL: Record<ResearchItem["sourceType"], string> = {
  OFFICIAL: "Official source",
  GOVERNMENT: "Government",
  REGULATOR: "Regulator",
  POLICY: "Company policy",
  SECONDARY: "Secondary source",
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
  if (!available) {
    return (
      <div className="space-y-4">
        <CapabilityNotice>
          {unavailableReason ??
            "Web research isn't connected on this deployment, so we haven't looked anything up. Nothing here has been checked against an outside source."}
        </CapabilityNotice>
        {research.length === 0 && (
          <div className="rounded-2xl border border-line bg-white shadow-card">
            <EmptyState title="No research on file." body="When research is connected, findings and their sources appear here." />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-mute">
          We look at official and government sources first, and store the source for anything we rely on.
        </p>
        <Button size="sm" variant="secondary" onClick={onRun} loading={running}>
          {research.length > 0 ? "Look again" : "Look into this"}
        </Button>
      </div>

      {running && <LoadingState message="Looking for relevant information..." />}

      {research.length === 0 && !running ? (
        <div className="mt-4 rounded-2xl border border-line bg-white shadow-card">
          <EmptyState title="Nothing looked up yet." body="We'll check the rules and policies that apply to your situation." />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {research.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <p className="text-[13px] font-medium text-ink-mute">{item.question}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{item.finding}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={TONE[item.sourceType]}>{LABEL[item.sourceType]}</Badge>
                <Badge tone={item.confidence === "HIGH" ? "ok" : item.confidence === "MEDIUM" ? "neutral" : "warn"}>
                  {item.confidence === "HIGH" ? "Confident" : item.confidence === "MEDIUM" ? "Fairly confident" : "Unverified"}
                </Badge>
                <span className="text-[12.5px] text-ink-faint">Found {relativeTime(item.retrievedAt)}</span>
              </div>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-2 inline-block break-all text-[13px] text-ink underline underline-offset-4 hover:text-ink-soft"
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

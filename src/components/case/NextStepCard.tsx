"use client";

import * as React from "react";
import type { Case } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/client";

/**
 * The most important element on the case screen: the single thing to do next.
 * Everything else is context for this.
 */
export function NextStepCard({
  record,
  onAct,
  actLabel,
  busy,
}: {
  record: Case;
  onAct?: () => void;
  actLabel?: string;
  busy?: boolean;
}) {
  const t = useT();
  const open = record.unknowns.filter((u) => !u.resolved);
  const openQuestion = open.find((u) => u.importance === "REQUIRED") ?? open[0];

  if (record.status === "RESOLVED") {
    return (
      <div className="rounded-2xl border border-signal-ok/25 bg-signal-okbg px-5 py-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-signal-ok">
          {t("caseView.resolvedLabel")}
        </p>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">{t("caseView.resolvedBody")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-white px-5 py-5 shadow-card">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {t("caseView.nextStepLabel")}
      </p>
      {/* Case content keeps its own language, whatever the interface is set to. */}
      <p dir="auto" className="mt-2 text-[17px] leading-snug text-ink">
        {openQuestion?.question ?? record.currentNextAction ?? t("caseView.nextStepNone")}
      </p>
      {openQuestion && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-mute">
          <span className="font-medium text-ink-soft">{t("caseView.whyAsking")} </span>
          {/* The reason is case content; isolating it keeps a Hebrew sentence
              from reordering an English label around it, and the reverse. */}
          <span dir="auto" className="bidi-isolate">
            {openQuestion.reason}
          </span>
        </p>
      )}
      {onAct && actLabel && (
        <div className="mt-4">
          <Button onClick={onAct} loading={busy}>
            {actLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

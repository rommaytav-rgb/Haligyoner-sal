"use client";

import * as React from "react";
import type { Case } from "@/domain/types";
import { Button } from "@/components/ui/Button";

/**
 * The most important element on the case screen: the single thing to do next
 * (section 30). Everything else is context for this.
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
  const nextAction = record.currentNextAction;
  const open = record.unknowns.filter((u) => !u.resolved);
  const openQuestion = open.find((u) => u.importance === "REQUIRED") ?? open[0];

  if (record.status === "RESOLVED") {
    return (
      <div className="rounded-2xl border border-signal-ok/25 bg-signal-okbg px-5 py-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-signal-ok">Resolved</p>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">
          You confirmed this one is fixed. Nothing left to do.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-white px-5 py-5 shadow-card">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">What you need to do next</p>
      <p className="mt-2 text-[17px] leading-snug text-ink">
        {openQuestion?.question ?? nextAction ?? "Nothing right now - we'll let you know when there is."}
      </p>
      {openQuestion && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-mute">
          <span className="font-medium text-ink-soft">Why we&rsquo;re asking: </span>
          {openQuestion.reason}
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

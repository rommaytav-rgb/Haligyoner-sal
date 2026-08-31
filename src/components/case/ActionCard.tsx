"use client";

import type { ActionStep } from "@/domain/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useT } from "@/i18n/client";

const STATUS_TONE: Record<ActionStep["status"], BadgeTone> = {
  PENDING: "neutral",
  REQUIRES_APPROVAL: "warn",
  APPROVED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
  FAILED: "risk",
  CANCELLED: "neutral",
};

export function ActionCard({
  action,
  index,
  children,
}: {
  action: ActionStep;
  index: number;
  children?: React.ReactNode;
}) {
  const t = useT();
  const done = action.status === "COMPLETED";

  return (
    <li className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums ${
            done ? "bg-signal-okbg text-signal-ok" : "bg-paper-sunk text-ink-mute"
          }`}
          aria-hidden="true"
        >
          {done ? "✓" : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              dir="auto"
              className={`text-[15px] font-semibold leading-snug ${done ? "text-ink-mute line-through" : "text-ink"}`}
            >
              {action.title}
            </h3>
            <Badge tone={STATUS_TONE[action.status]}>{t(`actionStatus.${action.status}`)}</Badge>
            {/* Delivery state is shown separately so "approved" never reads as "sent". */}
            {action.deliveryState && action.deliveryState !== "DRAFTED" && (
              <Badge tone="neutral">{t(`delivery.${action.deliveryState}`)}</Badge>
            )}
          </div>
          <p dir="auto" className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">
            {action.description}
          </p>
          {action.toolAvailable === false && (
            <p className="mt-2 text-[13px] text-ink-mute">{t("plan.notConnectedNote")}</p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </li>
  );
}

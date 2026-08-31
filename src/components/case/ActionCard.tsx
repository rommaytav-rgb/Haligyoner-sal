import type { ActionStep } from "@/domain/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

const STATUS_LABEL: Record<ActionStep["status"], string> = {
  PENDING: "To do",
  REQUIRES_APPROVAL: "Needs approval",
  APPROVED: "Approved",
  IN_PROGRESS: "In progress",
  COMPLETED: "Done",
  FAILED: "Didn't work",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<ActionStep["status"], BadgeTone> = {
  PENDING: "neutral",
  REQUIRES_APPROVAL: "warn",
  APPROVED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "ok",
  FAILED: "risk",
  CANCELLED: "neutral",
};

/** Delivery state is shown separately so "approved" never reads as "sent" (section 25). */
const DELIVERY_LABEL: Record<NonNullable<ActionStep["deliveryState"]>, string> = {
  DRAFTED: "Draft ready",
  APPROVED: "Approved - not sent from here",
  IN_PROGRESS: "Sending",
  SENT: "Sent",
  DELIVERED: "Delivered",
  RESPONSE_RECEIVED: "Reply received",
  FAILED: "Not sent",
  UNKNOWN: "Status unknown",
};

export function ActionCard({ action, index, children }: { action: ActionStep; index: number; children?: React.ReactNode }) {
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
            <h3 className={`text-[15px] font-semibold leading-snug ${done ? "text-ink-mute line-through" : "text-ink"}`}>
              {action.title}
            </h3>
            <Badge tone={STATUS_TONE[action.status]}>{STATUS_LABEL[action.status]}</Badge>
            {action.deliveryState && action.deliveryState !== "DRAFTED" && (
              <Badge tone="neutral">{DELIVERY_LABEL[action.deliveryState]}</Badge>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">{action.description}</p>
          {action.toolAvailable === false && (
            <p className="mt-2 text-[13px] text-ink-mute">
              This step needs a connection we don&rsquo;t have yet, so we&rsquo;ll prepare it for you to send yourself.
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </li>
  );
}

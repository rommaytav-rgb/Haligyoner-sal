import Link from "next/link";
import type { Notification } from "@/domain/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/format";

const KIND_LABEL: Record<Notification["kind"], string> = {
  INFORMATION_REQUIRED: "Needs your input",
  APPROVAL_REQUIRED: "Needs approval",
  DEADLINE: "Deadline",
  FOLLOW_UP: "Follow-up",
  NEW_RESPONSE: "New response",
  STATUS_CHANGE: "Update",
};

const KIND_TONE: Record<Notification["kind"], BadgeTone> = {
  INFORMATION_REQUIRED: "warn",
  APPROVAL_REQUIRED: "warn",
  DEADLINE: "risk",
  FOLLOW_UP: "info",
  NEW_RESPONSE: "info",
  STATUS_CHANGE: "neutral",
};

export function NotificationItem({ notification }: { notification: Notification }) {
  const content = (
    <div className="flex items-start gap-3">
      {!notification.readAt && (
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-label="unread" />
      )}
      <div className={notification.readAt ? "ml-[18px] min-w-0 flex-1" : "min-w-0 flex-1"}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={KIND_TONE[notification.kind]}>{KIND_LABEL[notification.kind]}</Badge>
          <span className="text-[12.5px] text-ink-faint">{relativeTime(notification.createdAt)}</span>
        </div>
        <p className="mt-1.5 text-[14px] font-medium text-ink">{notification.title}</p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">{notification.body}</p>
      </div>
    </div>
  );

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:bg-paper-warm">
      {notification.caseId ? <Link href={`/cases/${notification.caseId}`}>{content}</Link> : content}
    </li>
  );
}

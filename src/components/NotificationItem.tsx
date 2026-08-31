"use client";

import Link from "next/link";
import type { Notification } from "@/domain/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/client";
import { renderSystemText } from "@/i18n/system-text";

const KIND_TONE: Record<Notification["kind"], BadgeTone> = {
  INFORMATION_REQUIRED: "warn",
  APPROVAL_REQUIRED: "warn",
  DEADLINE: "risk",
  FOLLOW_UP: "info",
  NEW_RESPONSE: "info",
  STATUS_CHANGE: "neutral",
};

export function NotificationItem({ notification }: { notification: Notification }) {
  const { t, relativeTime } = useI18n();

  const content = (
    <div className="flex items-start gap-3">
      {!notification.readAt && (
        <span
          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
          aria-label={t("common.unreadNotifications")}
        />
      )}
      <div className={notification.readAt ? "ms-[18px] min-w-0 flex-1" : "min-w-0 flex-1"}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={KIND_TONE[notification.kind]}>{t(`notificationKind.${notification.kind}`)}</Badge>
          <span className="text-[12.5px] text-ink-faint">{relativeTime(notification.createdAt)}</span>
        </div>
        {/* The title is case content and keeps its own language; the body may be
            a stored system message, which renders in the reader's language. */}
        <p dir="auto" className="mt-1.5 text-[14px] font-medium text-ink">
          {notification.title}
        </p>
        <p dir="auto" className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">
          {renderSystemText(t, notification.bodyText, notification.body)}
        </p>
      </div>
    </div>
  );

  return (
    <li className="rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:bg-paper-warm">
      {notification.caseId ? <Link href={`/cases/${notification.caseId}`}>{content}</Link> : content}
    </li>
  );
}

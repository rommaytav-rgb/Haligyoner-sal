import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { listNotifications, unreadCount } from "@/server/services/notifications";
import { AppShell } from "@/components/nav/AppShell";
import { NotificationItem } from "@/components/NotificationItem";
import { EmptyState } from "@/components/ui/States";
import { getI18n } from "@/i18n/server";
import { MarkAllReadButton } from "@/components/MarkAllReadButton";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/notifications");

  const [{ t }, notifications, unread] = await Promise.all([
    getI18n(),
    listNotifications(user.id),
    unreadCount(user.id),
  ]);

  return (
    <AppShell user={user} unread={unread}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="display text-[28px] text-ink">{t("notifications.title")}</h1>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white shadow-card">
          <EmptyState
            title={t("notifications.emptyTitle")}
            body={t("notifications.emptyBody")}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-2.5">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
    </AppShell>
  );
}

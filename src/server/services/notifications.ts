import { COLLECTIONS, getStore } from "@/server/db";
import { newId, now } from "@/domain/ids";
import type { Notification, NotificationKind } from "@/domain/types";
import { resolveRecord, type Recordable } from "@/server/i18n";
import { log } from "@/lib/logger";

/**
 * Notification delivery. In-app is the only channel implemented; the interface
 * exists so email, push and SMS can be added as further channels without
 * touching call sites (section 35).
 */
export interface NotificationChannel {
  readonly name: string;
  readonly enabled: boolean;
  deliver(notification: Notification): Promise<void>;
}

const inAppChannel: NotificationChannel = {
  name: "in-app",
  enabled: true,
  async deliver() {
    // The stored document is the delivery.
  },
};

const channels: NotificationChannel[] = [inAppChannel];

export function registerChannel(channel: NotificationChannel): void {
  channels.push(channel);
}

export async function notify(input: {
  userId: string;
  caseId?: string;
  kind: NotificationKind;
  /** Usually the case title, which keeps the language the case was written in. */
  title: string;
  /** A catalogue reference for system text, or a plain string for content. */
  body: Recordable;
}): Promise<Notification> {
  const body = resolveRecord(input.body);

  const notification: Notification = {
    id: newId("ntf"),
    userId: input.userId,
    caseId: input.caseId,
    kind: input.kind,
    title: input.title.slice(0, 160),
    body: body.text.slice(0, 400),
    bodyText: body.ref,
    createdAt: now(),
  };
  await getStore().put(COLLECTIONS.notifications, notification);

  for (const channel of channels.filter((c) => c.enabled)) {
    try {
      await channel.deliver(notification);
    } catch (error) {
      log.warn({ event: "notification.delivery_failed", channel: channel.name, error: String(error) });
    }
  }
  return notification;
}

export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  return getStore().query<Notification>(COLLECTIONS.notifications, [{ field: "userId", op: "==", value: userId }], {
    orderBy: { field: "createdAt", direction: "desc" },
    limit,
  });
}

export async function markAllRead(userId: string): Promise<number> {
  const unread = (await listNotifications(userId, 200)).filter((n) => !n.readAt);
  const stamp = now();
  for (const n of unread) {
    await getStore().patch<Notification>(COLLECTIONS.notifications, n.id, { readAt: stamp });
  }
  return unread.length;
}

export async function unreadCount(userId: string): Promise<number> {
  return (await listNotifications(userId, 200)).filter((n) => !n.readAt).length;
}

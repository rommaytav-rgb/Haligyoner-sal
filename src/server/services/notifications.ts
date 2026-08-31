import { COLLECTIONS, getStore } from "@/server/db";
import { newId, now } from "@/domain/ids";
import type { Notification, NotificationKind } from "@/domain/types";
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
  title: string;
  body: string;
}): Promise<Notification> {
  const notification: Notification = {
    id: newId("ntf"),
    userId: input.userId,
    caseId: input.caseId,
    kind: input.kind,
    title: input.title.slice(0, 160),
    body: input.body.slice(0, 400),
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

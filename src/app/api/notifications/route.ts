import { listNotifications } from "@/server/services/notifications";
import { authedRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";

export const GET = authedRoute(async ({ user }) => ({ notifications: await listNotifications(user.id) }), {
  rateLimit: { key: "read", rule: RATE_LIMITS.read },
});

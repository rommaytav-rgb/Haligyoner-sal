import { markAllRead } from "@/server/services/notifications";
import { authedRoute } from "@/server/http/route";

export const POST = authedRoute(async ({ user }) => ({ marked: await markAllRead(user.id) }));

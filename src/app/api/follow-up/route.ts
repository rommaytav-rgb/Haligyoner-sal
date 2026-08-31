import { runFollowUp } from "@/server/agents/followup-agent";
import { authedRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";

/**
 * Follow-up sweep for the signed-in user. Designed to be driven by Cloud
 * Scheduler per user later; for now it runs when the app asks.
 */
export const POST = authedRoute(
  async ({ user }) => {
    const result = await runFollowUp(user.id);
    return { remindersSent: result.remindersSent, overdue: result.overdueTasks.length };
  },
  { rateLimit: { key: "message", rule: RATE_LIMITS.message } },
);

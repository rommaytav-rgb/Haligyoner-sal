import { idSchema } from "@/lib/validation";
import { listTimeline, requireOwnedCase } from "@/server/services/cases";
import { authedRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";

export const GET = authedRoute<{ id: string }>(
  async ({ user, params }) => {
    const caseId = idSchema.parse(params.id);
    await requireOwnedCase(user.id, caseId);
    return { timeline: await listTimeline(caseId) };
  },
  { rateLimit: { key: "read", rule: RATE_LIMITS.read } },
);

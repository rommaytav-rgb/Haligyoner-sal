import { idSchema } from "@/lib/validation";
import { prepareDraft } from "@/server/agents/action-agent";
import { listActions } from "@/server/services/cases";
import { authedRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";

type Params = { id: string; actionId: string };

/** Prepares (or re-prepares) the draft for a step. Nothing is sent. */
export const POST = authedRoute<Params>(
  async ({ user, params }) => {
    const caseId = idSchema.parse(params.id);
    const action = await prepareDraft(user.id, caseId, idSchema.parse(params.actionId));
    return { action, actions: await listActions(caseId) };
  },
  { rateLimit: { key: "message", rule: RATE_LIMITS.message } },
);

import { idSchema } from "@/lib/validation";
import { listActions, requireOwnedCase } from "@/server/services/cases";
import { runPlanning } from "@/server/agents/planning-agent";
import { authedRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";

type Params = { id: string };

export const GET = authedRoute<Params>(async ({ user, params }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  return { actions: await listActions(caseId) };
});

/** Builds or rebuilds the action plan. */
export const POST = authedRoute<Params>(
  async ({ user, params }) => {
    const caseId = idSchema.parse(params.id);
    await requireOwnedCase(user.id, caseId);
    const plan = await runPlanning(user.id, caseId);
    return { actions: plan.steps, nextAction: plan.nextAction };
  },
  { rateLimit: { key: "message", rule: RATE_LIMITS.message } },
);

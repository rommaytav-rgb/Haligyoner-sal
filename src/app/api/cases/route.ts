import { createCaseSchema } from "@/lib/validation";
import { runIntake } from "@/server/agents/intake-agent";
import { listCases } from "@/server/services/cases";
import { authedRoute, parseBody } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";

export const GET = authedRoute(async ({ user }) => ({ cases: await listCases(user.id) }), {
  rateLimit: { key: "read", rule: RATE_LIMITS.read },
});

export const POST = authedRoute(
  async ({ user, request }) => {
    const body = await parseBody(request, createCaseSchema);
    const result = await runIntake(user.id, body.problem, body.categoryHint);
    return {
      case: result.case,
      reply: result.reply,
      modelBacked: result.modelBacked,
      limitationNote: result.limitationNote,
    };
  },
  { rateLimit: { key: "case-create", rule: RATE_LIMITS.caseCreate } },
);

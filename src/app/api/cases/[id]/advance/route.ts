import { idSchema } from "@/lib/validation";
import { advanceCase } from "@/server/agents/orchestrator";
import { listActions, requireOwnedCase } from "@/server/services/cases";
import { authedRoute } from "@/server/http/route";
import { getRequestTranslator } from "@/i18n/server";
import { RATE_LIMITS } from "@/server/http/rate-limit";

type Params = { id: string };

/** Runs the orchestrator without a new user message - "work on this now". */
export const POST = authedRoute<Params>(
  async ({ user, params }) => {
    const caseId = idSchema.parse(params.id);
    await requireOwnedCase(user.id, caseId);
    const t = await getRequestTranslator();
    const result = await advanceCase(user.id, caseId, { kind: "REFRESH" });
    return {
      case: result.case,
      reply: result.reply,
      steps: result.steps,
      limitations: result.limitationKeys.map((key) => t(key)),
      actions: await listActions(caseId),
    };
  },
  { rateLimit: { key: "message", rule: RATE_LIMITS.message } },
);

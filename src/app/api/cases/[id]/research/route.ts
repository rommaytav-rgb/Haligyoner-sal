import { idSchema } from "@/lib/validation";
import { listResearch, requireOwnedCase } from "@/server/services/cases";
import { runInvestigation } from "@/server/agents/investigation-agent";
import { authedRoute } from "@/server/http/route";
import { getRequestTranslator } from "@/i18n/server";
import { RATE_LIMITS } from "@/server/http/rate-limit";

type Params = { id: string };

export const GET = authedRoute<Params>(
  async ({ user, params }) => {
    const caseId = idSchema.parse(params.id);
    await requireOwnedCase(user.id, caseId);
    return { research: await listResearch(caseId) };
  },
  { rateLimit: { key: "read", rule: RATE_LIMITS.read } },
);

/** Runs research on demand. Reports honestly when the capability is missing. */
export const POST = authedRoute<Params>(
  async ({ user, params }) => {
    const caseId = idSchema.parse(params.id);
    await requireOwnedCase(user.id, caseId);
    const result = await runInvestigation(user.id, caseId);
    const t = await getRequestTranslator();
    return {
      ran: result.ran,
      unavailableReason: result.unavailableKey ? t(result.unavailableKey) : undefined,
      findingsAdded: result.findingsAdded,
      research: await listResearch(caseId),
    };
  },
  { rateLimit: { key: "message", rule: RATE_LIMITS.message } },
);

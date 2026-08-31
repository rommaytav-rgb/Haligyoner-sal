import { approveActionSchema, idSchema } from "@/lib/validation";
import { approveAction } from "@/server/agents/action-agent";
import { listActions } from "@/server/services/cases";
import { authedRoute, parseBody } from "@/server/http/route";
import { getRequestTranslator } from "@/i18n/server";
import { RATE_LIMITS } from "@/server/http/rate-limit";

type Params = { id: string; actionId: string };

export const POST = authedRoute<Params>(
  async ({ user, params, request }) => {
    const caseId = idSchema.parse(params.id);
    const actionId = idSchema.parse(params.actionId);
    // `confirm: true` is required in the body: an approval can never be the
    // accidental result of a stray request (section 24).
    const body = await parseBody(request, approveActionSchema);

    const result = await approveAction(user.id, caseId, actionId, body.editedBody);
    const t = await getRequestTranslator();
    return {
      action: result.action,
      performed: result.performed,
      message: t.ref(result.messageKey, result.messageParams),
      actions: await listActions(caseId),
    };
  },
  { rateLimit: { key: "message", rule: RATE_LIMITS.message } },
);

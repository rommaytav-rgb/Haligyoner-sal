import { idSchema, messageSchema } from "@/lib/validation";
import { z } from "zod";
import { advanceCase } from "@/server/agents/orchestrator";
import { listMessages, requireOwnedCase, assertOpenForEditing } from "@/server/services/cases";
import { authedRoute, parseBody } from "@/server/http/route";
import { getRequestTranslator } from "@/i18n/server";
import { RATE_LIMITS } from "@/server/http/rate-limit";

type Params = { id: string };

export const GET = authedRoute<Params>(async ({ user, params }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  return { messages: await listMessages(caseId) };
});

export const POST = authedRoute<Params>(
  async ({ user, params, request }) => {
    const caseId = idSchema.parse(params.id);
    const record = await requireOwnedCase(user.id, caseId);
    assertOpenForEditing(record);

    const { content } = await parseBody(request, z.object({ content: messageSchema }));
    const t = await getRequestTranslator();
    const result = await advanceCase(user.id, caseId, { kind: "MESSAGE", message: content });

    return {
      case: result.case,
      reply: result.reply,
      appliedChanges: result.appliedChanges,
      limitations: result.limitationKeys.map((key) => t(key)),
      messages: await listMessages(caseId),
    };
  },
  { rateLimit: { key: "message", rule: RATE_LIMITS.message } },
);

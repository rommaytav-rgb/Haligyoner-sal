import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { addTimelineEvent, requireOwnedCase, setStatus } from "@/server/services/cases";
import { authedRoute, parseBody } from "@/server/http/route";

type Params = { id: string };

const schema = z.object({ resolved: z.boolean(), note: z.string().trim().max(500).optional() });

/**
 * Resolution is a claim about the real world, so only the user makes it. "Not
 * yet" is a first-class answer that puts the case back into follow-up (section 65).
 */
export const POST = authedRoute<Params>(async ({ user, params, request }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  const body = await parseBody(request, schema);

  if (body.resolved) {
    const record = await setStatus(user.id, caseId, "RESOLVED", body.note ?? "You confirmed this is fixed.", {
      userConfirmedResolution: true,
    });
    await addTimelineEvent(caseId, {
      title: "You confirmed this is resolved",
      description: body.note ?? "",
      source: "USER",
    });
    return { case: record };
  }

  const record = await setStatus(user.id, caseId, "FOLLOW_UP_REQUIRED", body.note ?? "Not fixed yet.");
  return { case: record };
});

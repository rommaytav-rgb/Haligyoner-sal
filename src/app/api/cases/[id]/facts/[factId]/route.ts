import { idSchema } from "@/lib/validation";
import { listFacts, removeFact } from "@/server/services/cases";
import { authedRoute } from "@/server/http/route";

type Params = { id: string; factId: string };

/** Lets the user retract something we recorded wrongly (sections 63, 64). */
export const DELETE = authedRoute<Params>(async ({ user, params }) => {
  const caseId = idSchema.parse(params.id);
  await removeFact(user.id, caseId, idSchema.parse(params.factId));
  return { facts: await listFacts(caseId) };
});

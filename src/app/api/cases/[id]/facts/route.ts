import { addFactSchema, idSchema } from "@/lib/validation";
import { addFact, listFacts, requireOwnedCase } from "@/server/services/cases";
import { authedRoute, parseBody } from "@/server/http/route";

type Params = { id: string };

export const GET = authedRoute<Params>(async ({ user, params }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  return { facts: await listFacts(caseId) };
});

export const POST = authedRoute<Params>(async ({ user, params, request }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  const body = await parseBody(request, addFactSchema);
  const fact = await addFact(caseId, body, { userId: user.id });
  return { fact, facts: await listFacts(caseId) };
});

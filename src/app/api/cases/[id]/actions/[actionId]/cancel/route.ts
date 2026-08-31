import { idSchema } from "@/lib/validation";
import { cancelAction } from "@/server/agents/action-agent";
import { listActions } from "@/server/services/cases";
import { authedRoute } from "@/server/http/route";

type Params = { id: string; actionId: string };

export const POST = authedRoute<Params>(async ({ user, params }) => {
  const caseId = idSchema.parse(params.id);
  const action = await cancelAction(user.id, caseId, idSchema.parse(params.actionId));
  return { action, actions: await listActions(caseId) };
});

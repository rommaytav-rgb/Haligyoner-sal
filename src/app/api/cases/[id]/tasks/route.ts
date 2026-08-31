import { idSchema, taskSchema } from "@/lib/validation";
import { addTask, listTasks, requireOwnedCase } from "@/server/services/cases";
import { authedRoute, parseBody } from "@/server/http/route";

type Params = { id: string };

export const GET = authedRoute<Params>(async ({ user, params }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  return { tasks: await listTasks(caseId) };
});

export const POST = authedRoute<Params>(async ({ user, params, request }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  const body = await parseBody(request, taskSchema);
  const task = await addTask(caseId, body);
  return { task, tasks: await listTasks(caseId) };
});

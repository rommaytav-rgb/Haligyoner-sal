import { idSchema, updateTaskSchema } from "@/lib/validation";
import { updateTask } from "@/server/services/cases";
import { authedRoute, parseBody } from "@/server/http/route";

export const PATCH = authedRoute<{ id: string }>(async ({ user, params, request }) => {
  const body = await parseBody(request, updateTaskSchema);
  const task = await updateTask(user.id, idSchema.parse(params.id), body.status);
  return { task };
});

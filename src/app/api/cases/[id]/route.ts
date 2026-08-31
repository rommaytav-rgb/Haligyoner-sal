import { idSchema, updateCaseSchema } from "@/lib/validation";
import {
  deleteCase,
  listActions,
  listEvidence,
  listFacts,
  listMessages,
  listResearch,
  listTasks,
  listTimeline,
  patchCase,
  requireOwnedCase,
  setStatus,
} from "@/server/services/cases";
import { listAuditForCase } from "@/server/services/audit";
import { authedRoute, parseBody } from "@/server/http/route";
import { systemText } from "@/server/i18n";
import { RATE_LIMITS } from "@/server/http/rate-limit";

type Params = { id: string };

export const GET = authedRoute<Params>(
  async ({ user, params }) => {
    const caseId = idSchema.parse(params.id);
    const record = await requireOwnedCase(user.id, caseId);

    const [facts, evidence, timeline, tasks, research, actions, messages, activity] = await Promise.all([
      listFacts(caseId),
      listEvidence(caseId),
      listTimeline(caseId),
      listTasks(caseId),
      listResearch(caseId),
      listActions(caseId),
      listMessages(caseId),
      listAuditForCase(caseId, 30),
    ]);

    return { case: record, facts, evidence, timeline, tasks, research, actions, messages, activity };
  },
  { rateLimit: { key: "read", rule: RATE_LIMITS.read } },
);

export const PATCH = authedRoute<Params>(async ({ user, params, request }) => {
  const caseId = idSchema.parse(params.id);
  const body = await parseBody(request, updateCaseSchema);
  const { status, resolutionConfirmedByUser, ...fields } = body;

  let record = await requireOwnedCase(user.id, caseId);
  if (Object.keys(fields).length > 0) {
    record = await patchCase(user.id, caseId, fields);
  }
  if (status) {
    record = await setStatus(user.id, caseId, status, systemText("system.userChangedStatus"), {
      userConfirmedResolution: resolutionConfirmedByUser === true,
    });
  }
  return { case: record };
});

export const DELETE = authedRoute<Params>(async ({ user, params }) => {
  await deleteCase(user.id, idSchema.parse(params.id));
  return { ok: true };
});


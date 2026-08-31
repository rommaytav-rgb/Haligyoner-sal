import { idSchema } from "@/lib/validation";
import { processEvidence } from "@/server/agents/evidence-agent";
import { listEvidence, listFacts, requireOwnedCase } from "@/server/services/cases";
import { authedRoute } from "@/server/http/route";
import { RATE_LIMITS } from "@/server/http/rate-limit";
import { invalid } from "@/lib/errors";
import { config } from "@/lib/config";

type Params = { id: string };

export const GET = authedRoute<Params>(async ({ user, params }) => {
  const caseId = idSchema.parse(params.id);
  await requireOwnedCase(user.id, caseId);
  return { evidence: await listEvidence(caseId) };
});

export const POST = authedRoute<Params>(
  async ({ user, params, request }) => {
    const caseId = idSchema.parse(params.id);
    await requireOwnedCase(user.id, caseId);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw invalid("errors.attachFile");
    if (file.size > config.maxUploadBytes) {
      throw invalid("errors.fileTooLarge", { limit: Math.round(config.maxUploadBytes / (1024 * 1024)) });
    }

    const data = Buffer.from(await file.arrayBuffer());
    const result = await processEvidence(user.id, caseId, {
      name: file.name,
      mimeType: file.type,
      data,
    });

    return {
      evidence: result.evidence,
      factsAdded: result.factsAdded,
      contradictions: result.contradictions,
      injectionObserved: result.injectionObserved,
      facts: await listFacts(caseId),
    };
  },
  { rateLimit: { key: "upload", rule: RATE_LIMITS.upload } },
);

import { now } from "@/domain/ids";
import { log } from "@/lib/logger";
import { searchOfficialSource } from "@/server/tools";
import { addResearch, buildCaseContext, listResearch } from "@/server/services/cases";
import { audit } from "@/server/services/audit";
import { caseText } from "@/server/i18n";
import { caseLocale } from "@/server/ai/language";

export interface InvestigationResult {
  ran: boolean;
  /** Catalogue key explaining why nothing was researched. */
  unavailableKey?: string;
  findingsAdded: number;
}

/**
 * Investigation Agent (section 21).
 *
 * Looks for the policies, rights and deadlines that decide the user's options.
 * If no research capability is connected it returns `ran: false` with the
 * reason - it never manufactures a finding, a policy or a URL (sections 27, 51).
 */
export async function runInvestigation(userId: string, caseId: string): Promise<InvestigationResult> {
  const context = await buildCaseContext(caseId);

  if (!searchOfficialSource.available) {
    return { ran: false, unavailableKey: searchOfficialSource.unavailableKey, findingsAdded: 0 };
  }

  const questions = buildResearchQuestions(context.caseRecord.primaryCategory, context.caseRecord.summary);
  const already = new Set((await listResearch(caseId)).map((r) => r.question));
  let findingsAdded = 0;

  for (const question of questions) {
    if (already.has(question)) continue;

    const result = await searchOfficialSource.run({ query: question } as never, {
      userId,
      caseId,
      riskLevel: context.caseRecord.riskLevel,
    });
    if (!result.ok) {
      log.warn({ event: "investigation.search_failed", caseId, outcome: result.reason });
      continue;
    }

    const hits = result.data as { title: string; url: string; snippet: string; sourceType: string }[];
    const best = hits[0];
    if (!best) continue;

    // The finding is the source's own snippet, attributed. Nothing is
    // paraphrased into a claim the source did not make.
    await addResearch(caseId, {
      question,
      finding: best.snippet || caseText("agent.seeLinkedSource", undefined, caseLocale(context.caseRecord.contentLocale)),
      sourceTitle: best.title,
      sourceUrl: best.url,
      sourceType: best.sourceType as "OFFICIAL",
      confidence: best.sourceType === "GOVERNMENT" || best.sourceType === "REGULATOR" ? "MEDIUM" : "LOW",
      retrievedAt: now(),
    });
    findingsAdded += 1;
  }

  if (findingsAdded > 0) {
    await audit("RESEARCH_COMPLETED", `${findingsAdded} findings`, { userId, caseId });
  }
  return { ran: true, findingsAdded };
}

/** Category-shaped questions, so an unknown category still gets useful queries. */
export function buildResearchQuestions(category: string | undefined, summary: string): string[] {
  const subject = summary.slice(0, 120);
  const generic = [
    `consumer rights and time limits for ${category ?? "this kind of problem"}`,
    `how to escalate a complaint about ${category ?? "this"} to an ombudsman or regulator`,
  ];

  const specific: Record<string, string[]> = {
    Payments: [`how to dispute an unauthorised card charge`, `chargeback time limits`],
    Delivery: [`rights when a parcel never arrives`, `who is responsible for a lost delivery, retailer or courier`],
    Travel: [`air passenger rights for a cancelled flight`, `compensation deadlines for cancelled flights`],
    Shopping: [`rights when goods arrive damaged or faulty`, `how long a retailer has to respond to a complaint`],
    Subscriptions: [`rights to cancel a subscription and stop auto-renewal`],
    Insurance: [`how to escalate a rejected insurance claim`],
    Housing: [`tenant rights regarding a deposit`],
  };

  return [...(specific[category ?? ""] ?? []), ...generic].slice(0, 3).map((q) => `${q} (${subject})`.slice(0, 200));
}

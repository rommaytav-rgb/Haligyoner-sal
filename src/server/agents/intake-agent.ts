import { newId, now } from "@/domain/ids";
import { normalizeCategory } from "@/domain/taxonomy";
import type { Case, Party } from "@/domain/types";
import { getAIProvider } from "@/server/ai";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { addFact, addMessage, addTimelineEvent, buildUnknown, saveCase } from "@/server/services/cases";
import { audit } from "@/server/services/audit";
import { notify } from "@/server/services/notifications";
import { assessRisk, HIGH_RISK_DISCLAIMER } from "./risk-agent";

export interface IntakeResult {
  case: Case;
  reply: string;
  /** True when a language model produced the understanding, false when rules did. */
  modelBacked: boolean;
  limitationNote?: string;
}

/**
 * Intake Agent (section 21).
 *
 * Turns a free-text account into a structured Case: title, summary, goal,
 * category, risk, first facts, and the questions whose answers would actually
 * change the options.
 */
export async function runIntake(
  userId: string,
  problem: string,
  categoryHint?: string,
): Promise<IntakeResult> {
  const provider = getAIProvider();

  let analysis;
  try {
    analysis = await provider.analyzeProblem({ problem, categoryHint });
  } catch (error) {
    log.error({ event: "intake.analyze_failed", userId, error });
    throw new AppError(
      "UPSTREAM_FAILED",
      "We couldn't work through that just now. Your words weren't lost - try again in a moment.",
    );
  }

  const risk = assessRisk(problem, analysis.riskLevel);
  const caseId = newId("case");
  const timestamp = now();

  const unknowns = analysis.questions.map((q) =>
    buildUnknown({ question: q.question, reason: q.reason, importance: q.importance }),
  );

  const parties: Party[] = analysis.involvedParties.map((p) => ({ id: newId("pty"), name: p.name, role: p.role }));

  const record: Case = {
    id: caseId,
    userId,
    title: analysis.title,
    summary: analysis.summary,
    originalProblem: problem,
    userGoal: analysis.userGoal,
    primaryCategory: normalizeCategory(analysis.primaryCategory),
    secondaryCategories: analysis.secondaryCategories.map(normalizeCategory),
    status: unknowns.length > 0 ? "INFORMATION_REQUIRED" : "INVESTIGATING",
    riskLevel: risk.level,
    riskNote: risk.note,
    involvedParties: parties,
    unknowns,
    currentNextAction: unknowns[0]?.question ?? "Review what we captured and correct anything that's wrong.",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await saveCase(record);
  await audit("CASE_CREATED", `category=${record.primaryCategory} risk=${record.riskLevel}`, { userId, caseId });

  for (const fact of analysis.facts) {
    await addFact(
      caseId,
      { statement: fact.statement, verification: fact.verification, confidence: fact.confidence },
      { userId },
    );
  }

  await addTimelineEvent(caseId, {
    title: "Case opened",
    description: "You told us what happened and we organised it into a case.",
    source: "USER",
  });
  for (const entry of analysis.timeline.slice(0, 6)) {
    await addTimelineEvent(caseId, {
      title: entry.title,
      description: entry.description,
      source: "AI_INFERENCE",
    });
  }

  const replyParts = [analysis.reply];
  if (risk.requiresProfessionalDisclaimer) replyParts.push(HIGH_RISK_DISCLAIMER);
  if (analysis.injectionObserved) replyParts.push(analysis.injectionObserved);
  const reply = replyParts.join("\n\n");

  await addMessage(caseId, "USER", problem);
  await addMessage(caseId, "ASSISTANT", reply, [
    `Created case "${record.title}"`,
    `Recorded ${analysis.facts.length} detail${analysis.facts.length === 1 ? "" : "s"}`,
    ...(unknowns.length ? [`Noted ${unknowns.length} open question${unknowns.length === 1 ? "" : "s"}`] : []),
  ]);

  if (unknowns.length > 0) {
    await notify({
      userId,
      caseId,
      kind: "INFORMATION_REQUIRED",
      title: record.title,
      body: unknowns[0].question,
    });
  }

  return {
    case: record,
    reply,
    modelBacked: provider.quality.modelBacked,
    limitationNote: provider.quality.limitationNote,
  };
}

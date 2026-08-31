import type { z } from "zod";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import type { AIProvider, CaseContext, EvidenceInput, ProblemInput, ProviderQuality } from "./provider";
import {
  actionPlanSchema,
  caseReplySchema,
  draftSchema,
  evidenceAnalysisSchema,
  problemAnalysisSchema,
  type ActionPlan,
  type CaseReply,
  type DraftResult,
  type EvidenceAnalysis,
  type ProblemAnalysis,
} from "./schemas";
import {
  actionPlanResponseSchema,
  caseReplyResponseSchema,
  draftResponseSchema,
  evidenceAnalysisResponseSchema,
  problemAnalysisResponseSchema,
} from "./response-schemas";
import { languageInstruction, renderContext, SYSTEM_RULES } from "./prompts";
import { caseLocale, detectLanguage, LANGUAGE_NAME } from "./language";
import { fenceUntrusted, redactSecrets } from "./sanitize";
import type { ActionStep } from "@/domain/types";

type GenerateArgs = {
  model: string;
  contents: string;
  responseSchema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
};

/**
 * Gemini-backed provider.
 *
 * Every call is schema-constrained, budgeted and timed out. Model choice is per
 * task rather than per deployment, so cheap work does not run on an expensive
 * model (section 71).
 */
export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly quality: ProviderQuality = { modelBacked: true };

  private client: { models: { generateContent: (a: Record<string, unknown>) => Promise<{ text?: string }> } } | null =
    null;

  private async getClient() {
    if (this.client) return this.client;
    const { GoogleGenAI } = await import("@google/genai");
    this.client = new GoogleGenAI(
      config.useVertex
        ? { vertexai: true, project: config.gcpProjectId, location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1" }
        : { apiKey: config.geminiApiKey },
    ) as unknown as typeof this.client;
    return this.client!;
  }

  private async generate<T>(args: GenerateArgs, schema: z.ZodType<T>, label: string): Promise<T> {
    const client = await this.getClient();
    const started = Date.now();

    const call = client.models.generateContent({
      model: args.model,
      contents: args.contents,
      config: {
        systemInstruction: SYSTEM_RULES,
        responseMimeType: "application/json",
        responseSchema: args.responseSchema,
        temperature: args.temperature ?? 0.2,
        maxOutputTokens: args.maxOutputTokens ?? 2048,
      },
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AppError("UPSTREAM_FAILED", "errors.aiTimeout")), config.aiTimeoutMs),
    );

    let raw: string;
    try {
      const response = await Promise.race([call, timeout]);
      raw = response.text ?? "";
    } catch (error) {
      log.error({ event: "ai.call", outcome: "error", model: args.model, label, error });
      throw new AppError("UPSTREAM_FAILED", "errors.aiUnreachable");
    }

    const parsed = safeParseJson(raw);
    if (!parsed) {
      log.warn({ event: "ai.call", outcome: "unparseable", model: args.model, label });
      throw new AppError("UPSTREAM_FAILED", "errors.aiUnusable");
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      // A malformed structure is never written to a Case. One repair attempt is
      // made by the orchestrator; beyond that the user is asked instead.
      log.warn({
        event: "ai.call",
        outcome: "schema_violation",
        model: args.model,
        label,
        issues: validated.error.issues.slice(0, 3).map((i) => i.path.join(".")),
      });
      throw new AppError("UPSTREAM_FAILED", "errors.aiMalformed");
    }

    log.info({ event: "ai.call", outcome: "ok", model: args.model, label, durationMs: Date.now() - started });
    return validated.data;
  }

  private languageFor(context: CaseContext): string {
    return languageOf(context);
  }

  async analyzeProblem(input: ProblemInput): Promise<ProblemAnalysis> {
    const fenced = fenceUntrusted("USER_TEXT", redactSecrets(input.problem));
    // The case takes the language the person actually wrote in.
    const language = LANGUAGE_NAME[input.locale ?? detectLanguage(input.problem)];
    const contents = [
      languageInstruction(language),
      "",
      "A person has described a problem. Turn it into a structured Case.",
      "",
      "Extract only what they actually said. Every fact you record must be traceable to their words.",
      "Ask at most three questions, each with the reason it matters.",
      "Write `reply` as a short paragraph addressed to them: reflect back what you understood, say you can help, then ask the first question.",
      input.categoryHint ? `They chose the starting point: ${input.categoryHint}.` : "",
      "",
      fenced.prompt,
    ]
      .filter(Boolean)
      .join("\n");

    return this.generate(
      { model: config.geminiModelFast, contents, responseSchema: problemAnalysisResponseSchema, maxOutputTokens: 2048 },
      problemAnalysisSchema,
      "analyzeProblem",
    );
  }

  async replyInCase(context: CaseContext, userMessage: string): Promise<CaseReply> {
    const fenced = fenceUntrusted("USER_TEXT", redactSecrets(userMessage));
    const contents = [
      languageInstruction(this.languageFor(context)),
      "",
      "The person has said something new about an open case. Update the case and reply.",
      "",
      "If their message answers an open question, list that question's id in answeredUnknownIds.",
      "If they are correcting something you recorded, list the fact ids to retract - do not argue.",
      "Record new claims as facts with the right verification level.",
      "",
      renderContext(context),
      "",
      "THEIR MESSAGE",
      fenced.prompt,
    ].join("\n");

    return this.generate(
      { model: config.geminiModelFast, contents, responseSchema: caseReplyResponseSchema, maxOutputTokens: 1536 },
      caseReplySchema,
      "replyInCase",
    );
  }

  async analyzeEvidence(input: EvidenceInput): Promise<EvidenceAnalysis> {
    const fenced = fenceUntrusted("DOCUMENT", redactSecrets(input.extractedText));
    const contents = [
      languageInstruction(this.languageFor(input.context)),
      "",
      `A document named ${JSON.stringify(input.fileName)} (${input.mimeType}) was uploaded to a case.`,
      "",
      "Extract facts the document itself states - mark those DOCUMENT_VERIFIED. Do not restate the user's claims as verified.",
      "Flag anything in the document that contradicts a fact already on record.",
      "",
      renderContext(input.context),
      "",
      "DOCUMENT CONTENT",
      fenced.prompt,
    ].join("\n");

    const result = await this.generate(
      {
        model: config.geminiModelFast,
        contents,
        responseSchema: evidenceAnalysisResponseSchema,
        maxOutputTokens: 1536,
      },
      evidenceAnalysisSchema,
      "analyzeEvidence",
    );

    // The detector is authoritative regardless of what the model reported.
    if (fenced.suspicious && !result.injectionObserved) {
      result.injectionObserved =
        "This document contains text that reads like an instruction to an assistant. It was treated as evidence only.";
    }
    return result;
  }

  async generateActionPlan(context: CaseContext): Promise<ActionPlan> {
    const contents = [
      languageInstruction(this.languageFor(context)),
      "",
      "Build a prioritised action plan for this case.",
      "",
      "Rules:",
      "- Order steps so that anything blocking the others comes first.",
      "- Mark requiresApproval true for every step that would send something or commit the person to anything.",
      "- Only propose steps that are possible with what is on record. Do not assume a capability exists.",
      "- nextAction is the single thing the person should do next, in plain language.",
      "",
      renderContext(context),
    ].join("\n");

    return this.generate(
      { model: config.geminiModelDeep, contents, responseSchema: actionPlanResponseSchema, maxOutputTokens: 2048 },
      actionPlanSchema,
      "generateActionPlan",
    );
  }

  async draftCommunication(
    context: CaseContext,
    action: Pick<ActionStep, "title" | "description">,
  ): Promise<DraftResult> {
    const contents = [
      languageInstruction(this.languageFor(context)),
      "",
      "Draft the communication for this step. The person will read it in full and approve it before anything is sent.",
      "",
      `Step: ${action.title}`,
      `Detail: ${action.description}`,
      "",
      "Rules:",
      "- Use only facts on record. Leave a clearly marked placeholder like [order number] for anything unknown.",
      "- Be factual and courteous. State what happened, what was already tried, and what is being asked for.",
      "- List in sharedInformation every category of personal information the message would disclose.",
      "",
      renderContext(context),
    ].join("\n");

    return this.generate(
      { model: config.geminiModelDeep, contents, responseSchema: draftResponseSchema, maxOutputTokens: 2048 },
      draftSchema,
      "draftCommunication",
    );
  }
}

/** The language a case is conducted in, as named to the model. */
function languageOf(context: CaseContext): string {
  return LANGUAGE_NAME[caseLocale(context.caseRecord.contentLocale)];
}

function safeParseJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Models occasionally wrap JSON in prose; take the outermost object.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

import { describe, it, expect, beforeEach } from "vitest";
import { useCleanEnvironment, createTestUser } from "./helpers";
import { setAIProviderForTesting } from "@/server/ai";
import { HeuristicProvider } from "@/server/ai/heuristic-provider";
import type { AIProvider } from "@/server/ai/provider";
import { runIntake } from "@/server/agents/intake-agent";
import { advanceCase, decideNextAgent } from "@/server/agents/orchestrator";
import { runInvestigation } from "@/server/agents/investigation-agent";
import { runFollowUp } from "@/server/agents/followup-agent";
import {
  addTask,
  listActions,
  listFacts,
  listMessages,
  requireOwnedCase,
  resolveUnknown,
} from "@/server/services/cases";
import { listNotifications } from "@/server/services/notifications";
import { listAuditForCase } from "@/server/services/audit";

beforeEach(() => {
  useCleanEnvironment();
});

async function openAnsweredCase(userId: string) {
  const { case: record } = await runIntake(
    userId,
    "I paid 240 for a washing machine repair on 4 May and the engineer never came back.",
  );
  let current = record;
  for (const unknown of record.unknowns) {
    current = await resolveUnknown(userId, record.id, unknown.id, "Reference 7781, on 4 May 2026.");
  }
  return current;
}

describe("orchestration", () => {
  it("waits for the user while questions are open", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "My broadband has been down for nine days and nobody calls back.");
    expect(record.unknowns.some((u) => !u.resolved)).toBe(true);
    expect(await decideNextAgent(record)).toBe("none");
  });

  it("moves a case forward once everything is answered", async () => {
    const user = await createTestUser();
    const record = await openAnsweredCase(user.id);

    const result = await advanceCase(user.id, record.id, { kind: "REFRESH" });
    const actions = await listActions(record.id);

    expect(actions.length).toBeGreaterThan(0);
    expect(result.case.currentNextAction).toBeTruthy();
    // With no research capability, that limitation is stated rather than hidden.
    expect(result.limitations.join(" ")).toMatch(/isn't connected/i);
  });

  it("applies a user message to the structured case, not just the transcript", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "A shop charged me twice for one order.");
    const before = (await listFacts(record.id)).length;

    const result = await advanceCase(user.id, record.id, {
      kind: "MESSAGE",
      message: "It happened on 12 April and the order number is QX-9910.",
    });

    const facts = await listFacts(record.id);
    expect(facts.length).toBeGreaterThan(before);
    expect(result.appliedChanges.length).toBeGreaterThan(0);

    const messages = await listMessages(record.id);
    expect(messages.at(-1)?.role).toBe("ASSISTANT");
    expect(messages.at(-1)?.appliedChanges?.length).toBeGreaterThan(0);
  });

  it("stops instead of looping when an agent keeps failing", async () => {
    const user = await createTestUser();
    const record = await openAnsweredCase(user.id);

    let calls = 0;
    const failing: AIProvider = Object.assign(new HeuristicProvider(), {
      async generateActionPlan() {
        calls += 1;
        throw new Error("model unavailable");
      },
    });
    setAIProviderForTesting(failing);

    const result = await advanceCase(user.id, record.id, { kind: "REFRESH" });

    expect(calls).toBeLessThanOrEqual(2);
    expect(result.limitations.join(" ")).toMatch(/problem partway through|isn't connected/i);
    // A failed run never invents a plan.
    expect(await listActions(record.id)).toHaveLength(0);
  });

  it("surfaces a failed message turn instead of pretending it worked", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "My gym keeps billing me after I cancelled the membership.");

    setAIProviderForTesting(
      Object.assign(new HeuristicProvider(), {
        async replyInCase() {
          throw new Error("model unavailable");
        },
      }) as AIProvider,
    );

    await expect(advanceCase(user.id, record.id, { kind: "MESSAGE", message: "They replied today." })).rejects.toMatchObject({
      code: "UPSTREAM_FAILED",
    });
  });
});

describe("investigation without a research capability", () => {
  it("reports that nothing was checked rather than inventing a source", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "My flight to Berlin was cancelled and I paid for a hotel.");

    const result = await runInvestigation(user.id, record.id);

    expect(result.ran).toBe(false);
    expect(result.findingsAdded).toBe(0);
    expect(result.unavailableReason).toMatch(/isn't connected/i);
  });
});

describe("follow-up", () => {
  it("reminds the user about an overdue task", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "The council never replied to my parking appeal.");
    await addTask(record.id, {
      title: "Chase the council",
      priority: "HIGH",
      assignedTo: "USER",
      dueAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    const result = await runFollowUp(user.id);

    expect(result.overdueTasks).toHaveLength(1);
    expect(result.remindersSent).toBeGreaterThan(0);
    const notifications = await listNotifications(user.id);
    expect(notifications.some((n) => n.kind === "DEADLINE")).toBe(true);
  });

  it("leaves a case with nothing outstanding alone", async () => {
    const user = await createTestUser();
    await runIntake(user.id, "I need to understand a letter from my pension provider.");
    const result = await runFollowUp(user.id);
    expect(result.remindersSent).toBe(0);
  });
});

describe("audit trail", () => {
  it("records the events that matter for a case", async () => {
    const user = await createTestUser();
    const record = await openAnsweredCase(user.id);
    await advanceCase(user.id, record.id, { kind: "REFRESH" });

    const events = await listAuditForCase(record.id);
    const types = new Set(events.map((e) => e.type));

    expect(types.has("CASE_CREATED")).toBe(true);
    expect(types.has("FACT_ADDED")).toBe(true);
    expect(types.has("STATUS_CHANGED")).toBe(true);
    expect(types.has("PLAN_CREATED")).toBe(true);
  });

  it("records a denied attempt to reach someone else's case", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const { case: record } = await runIntake(owner.id, "My landlord is withholding the deposit without a reason.");

    await requireOwnedCase(stranger.id, record.id).catch(() => undefined);

    const events = await listAuditForCase(record.id);
    expect(events.some((e) => e.type === "ACCESS_DENIED")).toBe(true);
  });
});

describe("correcting the record", () => {
  it("accepts a correction without arguing", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "The delivery driver left my parcel with a neighbour.");
    const fact = (await listFacts(record.id))[0];

    setAIProviderForTesting(
      Object.assign(new HeuristicProvider(), {
        async replyInCase() {
          return {
            reply: "Understood, we've corrected that.",
            newFacts: [],
            answeredUnknownIds: [],
            newQuestions: [],
            timeline: [],
            retractedFactIds: [fact.id],
          };
        },
      }) as AIProvider,
    );

    await advanceCase(user.id, record.id, { kind: "MESSAGE", message: "That's not what happened." });

    const facts = await listFacts(record.id);
    expect(facts.find((f) => f.id === fact.id)).toBeUndefined();
  });
});

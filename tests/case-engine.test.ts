import { describe, it, expect, beforeEach } from "vitest";
import { useCleanEnvironment, createTestUser } from "./helpers";
import { runIntake } from "@/server/agents/intake-agent";
import {
  addFact,
  listCases,
  listFacts,
  requireOwnedCase,
  setStatus,
  resolveUnknown,
  deleteCase,
} from "@/server/services/cases";
import { AppError } from "@/lib/errors";
import { canTransition } from "@/domain/status";

beforeEach(() => {
  useCleanEnvironment();
});

describe("case creation", () => {
  it("turns a free-text problem into a structured case", async () => {
    const user = await createTestUser();
    const result = await runIntake(
      user.id,
      "I bought headphones online and they arrived broken. The company hasn't answered my email.",
    );

    expect(result.case.id).toMatch(/^case_/);
    expect(result.case.userId).toBe(user.id);
    expect(result.case.title.length).toBeGreaterThan(3);
    expect(result.case.userGoal).toBeTruthy();
    expect(result.case.primaryCategory).toBeTruthy();
    expect(result.reply).toBeTruthy();

    const facts = await listFacts(result.case.id);
    expect(facts.length).toBeGreaterThan(0);
    // Nothing the user merely said is ever recorded as verified.
    expect(facts.every((f) => f.verification === "USER_REPORTED")).toBe(true);
  });

  it("records open questions with the reason each one matters", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "I was charged for a subscription I cancelled months ago.");

    expect(record.unknowns.length).toBeGreaterThan(0);
    for (const unknown of record.unknowns) {
      expect(unknown.reason.length).toBeGreaterThan(5);
      expect(unknown.resolved).toBe(false);
    }
    expect(record.status).toBe("INFORMATION_REQUIRED");
  });

  it("produces a usable case for a problem that fits no known category", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(
      user.id,
      "A neighbour keeps leaving something outside my door and I don't know who to tell about it.",
    );

    expect(record.primaryCategory).toBe("Other");
    expect(record.currentNextAction).toBeTruthy();
    expect(record.unknowns.length).toBeGreaterThan(0);
    expect((await listFacts(record.id)).length).toBeGreaterThan(0);
  });
});

describe("user isolation", () => {
  it("hides another user's case behind a not-found", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const { case: record } = await runIntake(owner.id, "My parcel never arrived and the courier won't respond.");

    await expect(requireOwnedCase(stranger.id, record.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listCases(stranger.id)).toHaveLength(0);
    expect(await listCases(owner.id)).toHaveLength(1);
  });

  it("refuses to let a stranger change a case's status", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const { case: record } = await runIntake(owner.id, "My flight was cancelled and nobody has offered a refund.");

    await expect(setStatus(stranger.id, record.id, "CLOSED", "attempt")).rejects.toBeInstanceOf(AppError);
    expect((await requireOwnedCase(owner.id, record.id)).status).not.toBe("CLOSED");
  });

  it("refuses to let a stranger delete a case", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const { case: record } = await runIntake(owner.id, "My electricity bill doubled with no explanation given.");

    await expect(deleteCase(stranger.id, record.id)).rejects.toBeInstanceOf(AppError);
    expect(await requireOwnedCase(owner.id, record.id)).toBeTruthy();
  });
});

describe("fact verification", () => {
  it("keeps user claims and document-verified facts distinct", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "The retailer charged me twice for the same order.");

    await addFact(record.id, {
      statement: "Order 1182 was charged on 3 March.",
      verification: "DOCUMENT_VERIFIED",
      confidence: "HIGH",
      sourceEvidenceId: "evd_test",
    });

    const facts = await listFacts(record.id);
    const verified = facts.filter((f) => f.verification === "DOCUMENT_VERIFIED");
    const reported = facts.filter((f) => f.verification === "USER_REPORTED");

    expect(verified).toHaveLength(1);
    expect(verified[0].sourceEvidenceId).toBe("evd_test");
    expect(reported.length).toBeGreaterThan(0);
  });

  it("does not record the same claim twice", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "My deposit was never returned after I moved out.");
    const before = (await listFacts(record.id)).length;

    await addFact(record.id, { statement: "Deposit not returned.", verification: "USER_REPORTED", confidence: "HIGH" });
    await addFact(record.id, { statement: "deposit not returned.", verification: "USER_REPORTED", confidence: "HIGH" });

    expect(await listFacts(record.id)).toHaveLength(before + 1);
  });

  it("records an answered question as a high-confidence user-reported fact", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "I was charged twice by an online shop last week.");
    const question = record.unknowns[0];

    const updated = await resolveUnknown(user.id, record.id, question.id, "Order number is AB-4471.");

    expect(updated.unknowns.find((u) => u.id === question.id)?.resolved).toBe(true);
    const facts = await listFacts(record.id);
    expect(facts.some((f) => f.statement.includes("AB-4471") && f.confidence === "HIGH")).toBe(true);
  });
});

describe("case status transitions", () => {
  it("permits legal moves and refuses illegal ones", () => {
    expect(canTransition("NEW", "INTAKE")).toBe(true);
    expect(canTransition("READY_FOR_ACTION", "AWAITING_USER_APPROVAL")).toBe(true);
    expect(canTransition("NEW", "RESOLVED")).toBe(false);
    expect(canTransition("CLOSED", "ACTION_IN_PROGRESS")).toBe(false);
  });

  it("never marks a case resolved without the user's confirmation", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "My refund was promised three weeks ago and never arrived.");
    await setStatus(user.id, record.id, "INVESTIGATING", "looking into it");
    await setStatus(user.id, record.id, "READY_FOR_ACTION", "plan ready");

    await expect(setStatus(user.id, record.id, "RESOLVED", "assumed fixed")).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const confirmed = await setStatus(user.id, record.id, "RESOLVED", "user says fixed", {
      userConfirmedResolution: true,
    });
    expect(confirmed.status).toBe("RESOLVED");
    expect(confirmed.resolutionConfirmedByUser).toBe(true);
  });
});

describe("declining resolution", () => {
  it("lets the user say 'not yet' from any active state", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "The shop promised a replacement washing machine and it never came.");

    for (const state of ["INVESTIGATING", "READY_FOR_ACTION", "AWAITING_USER_APPROVAL"] as const) {
      await setStatus(user.id, record.id, state, "test");
      const declined = await setStatus(user.id, record.id, "FOLLOW_UP_REQUIRED", "Not fixed yet.");
      expect(declined.status).toBe("FOLLOW_UP_REQUIRED");
      expect(declined.resolutionConfirmedByUser).toBeUndefined();
      await setStatus(user.id, record.id, "READY_FOR_ACTION", "reset");
    }
  });
});

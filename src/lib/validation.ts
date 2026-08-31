import { z } from "zod";
import { CATEGORIES } from "@/domain/taxonomy";

export const idSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid identifier.");

export const problemTextSchema = z
  .string()
  .trim()
  .min(10, "Tell us a little more so we can help — a sentence or two is enough.")
  .max(8000, "That's longer than we can take in one go. Try trimming it down.");

export const messageSchema = z.string().trim().min(1, "Write something first.").max(8000);

export const emailSchema = z.string().trim().toLowerCase().email("That doesn't look like an email address.");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.");

export const createCaseSchema = z.object({
  problem: problemTextSchema,
  categoryHint: z.enum(CATEGORIES).optional(),
});

export const updateCaseSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    summary: z.string().trim().max(2000).optional(),
    userGoal: z.string().trim().max(500).optional(),
    primaryCategory: z.string().trim().max(40).optional(),
    status: z
      .enum([
        "NEW", "INTAKE", "INVESTIGATING", "INFORMATION_REQUIRED", "READY_FOR_ACTION",
        "AWAITING_USER_APPROVAL", "ACTION_IN_PROGRESS", "WAITING_FOR_RESPONSE",
        "FOLLOW_UP_REQUIRED", "ESCALATION_AVAILABLE", "RESOLVED", "CLOSED",
      ])
      .optional(),
    resolutionConfirmedByUser: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const addFactSchema = z.object({
  statement: z.string().trim().min(3).max(1000),
  verification: z
    .enum(["USER_REPORTED", "DOCUMENT_VERIFIED", "SYSTEM_VERIFIED", "EXTERNAL_SOURCE", "INFERRED", "UNKNOWN"])
    .default("USER_REPORTED"),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export const answerUnknownSchema = z.object({
  unknownId: idSchema,
  answer: z.string().trim().min(1).max(2000),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueAt: z.string().datetime().optional(),
  assignedTo: z.enum(["USER", "AI"]).default("USER"),
});

export const updateTaskSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
});

export const approveActionSchema = z.object({
  /** The user may edit a draft before approving; the edited text is what counts. */
  editedBody: z.string().trim().max(20000).optional(),
  confirm: z.literal(true),
});

export const recordResponseSchema = z.object({
  content: z.string().trim().min(1).max(20000),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

/** Flattens a Zod error into a single sentence a person can act on. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? "That input didn't look right.";
}

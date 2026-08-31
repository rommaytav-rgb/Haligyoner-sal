import { z } from "zod";
import { CATEGORIES } from "@/domain/taxonomy";

export const idSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "validation.invalidId");

export const problemTextSchema = z
  .string()
  .trim()
  .min(10, "validation.problemTooShort")
  .max(8000, "validation.problemTooLong");

export const messageSchema = z.string().trim().min(1, "validation.messageEmpty").max(8000);

export const emailSchema = z.string().trim().toLowerCase().email("validation.invalidEmail");

export const passwordSchema = z
  .string()
  .min(10, "validation.passwordTooShort")
  .max(200, "validation.passwordTooLong");

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
  .refine((v) => Object.keys(v).length > 0, "errors.nothingToUpdate");

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

/**
 * Returns the catalogue key for the first problem found.
 *
 * Schema messages are written as keys so the reason reaches the user in their
 * own language. Anything Zod generates on its own (a wrong type, say) is not a
 * key, so it falls back to the generic message rather than leaking English.
 */
export function firstIssueKey(error: z.ZodError): string {
  const message = error.issues[0]?.message;
  if (message && /^(validation|errors)\.[A-Za-z]+$/.test(message)) return message;
  return "validation.generic";
}

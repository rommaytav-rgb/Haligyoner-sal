import { now } from "@/domain/ids";
import { isOpen } from "@/domain/status";
import type { Case, Task } from "@/domain/types";
import { listCases, listTasks, listActions, addTask, setStatus } from "@/server/services/cases";
import { notify } from "@/server/services/notifications";
import { log } from "@/lib/logger";
import { systemText } from "@/server/i18n";

export interface FollowUpResult {
  overdueTasks: Task[];
  remindersSent: number;
  casesNudged: string[];
}

const STALE_AFTER_DAYS = 7;

/**
 * Follow-Up Agent (section 21).
 *
 * Notices what has gone quiet: overdue tasks, approvals nobody acted on, and
 * cases sitting in "waiting for a response" past a reasonable window.
 */
export async function runFollowUp(userId: string): Promise<FollowUpResult> {
  const cases = (await listCases(userId)).filter((c) => isOpen(c.status));
  const overdueTasks: Task[] = [];
  const casesNudged: string[] = [];
  let remindersSent = 0;

  for (const record of cases) {
    const tasks = await listTasks(record.id);
    const overdue = tasks.filter((t) => t.status === "PENDING" && t.dueAt && new Date(t.dueAt) < new Date());
    overdueTasks.push(...overdue);

    for (const task of overdue) {
      await notify({
        userId,
        caseId: record.id,
        kind: "DEADLINE",
        title: record.title,
        body: systemText("system.overdueTask", { task: task.title }),
      });
      remindersSent += 1;
    }

    if (await needsNudge(record)) {
      casesNudged.push(record.id);
      remindersSent += 1;
      await notify({
        userId,
        caseId: record.id,
        kind: "FOLLOW_UP",
        title: record.title,
        body: systemText("system.staleCase", { days: STALE_AFTER_DAYS }, STALE_AFTER_DAYS),
      });
      await addTask(record.id, {
        title: systemText("system.staleTaskTitle"),
        description: systemText("system.staleTaskBody", { days: STALE_AFTER_DAYS }, STALE_AFTER_DAYS),
        priority: "MEDIUM",
        assignedTo: "USER",
        dueAt: now(),
      });
      try {
        await setStatus(userId, record.id, "FOLLOW_UP_REQUIRED", systemText("system.staleTaskBody", { days: STALE_AFTER_DAYS }, STALE_AFTER_DAYS));
      } catch {
        // The status may not permit the move; the reminder still stands.
      }
    }

    const awaitingApproval = (await listActions(record.id)).filter((a) => a.status === "REQUIRES_APPROVAL");
    if (awaitingApproval.length > 0 && daysSince(record.updatedAt) >= 2) {
      await notify({
        userId,
        caseId: record.id,
        kind: "APPROVAL_REQUIRED",
        title: record.title,
        body: systemText("system.approvalsWaiting", { count: awaitingApproval.length }, awaitingApproval.length),
      });
      remindersSent += 1;
    }
  }

  log.info({ event: "followup.completed", userId, remindersSent, overdue: overdueTasks.length });
  return { overdueTasks, remindersSent, casesNudged };
}

async function needsNudge(record: Case): Promise<boolean> {
  if (record.status !== "WAITING_FOR_RESPONSE") return false;
  return daysSince(record.updatedAt) >= STALE_AFTER_DAYS;
}

export function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

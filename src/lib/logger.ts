/**
 * Structured logging in the shape Cloud Logging understands. User-supplied
 * content is never logged wholesale — only lengths, ids and outcomes (§70).
 */

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

interface LogFields {
  event: string;
  userId?: string;
  caseId?: string;
  durationMs?: number;
  outcome?: string;
  [key: string]: unknown;
}

function emit(severity: Severity, fields: LogFields) {
  const entry = { severity, time: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry);
  if (severity === "ERROR") console.error(line);
  else if (severity === "WARNING") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (f: LogFields) => {
    if (process.env.NODE_ENV !== "production") emit("DEBUG", f);
  },
  info: (f: LogFields) => emit("INFO", f),
  warn: (f: LogFields) => emit("WARNING", f),
  error: (f: LogFields & { error?: unknown }) => {
    const { error, ...rest } = f;
    emit("ERROR", {
      ...rest,
      errorMessage: error instanceof Error ? error.message : String(error ?? ""),
      errorName: error instanceof Error ? error.name : undefined,
    });
  },
};

/** Times an operation and logs its outcome without capturing its payload. */
export async function timed<T>(event: string, fields: Omit<LogFields, "event">, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    log.info({ event, ...fields, durationMs: Date.now() - started, outcome: "ok" });
    return result;
  } catch (error) {
    log.error({ event, ...fields, durationMs: Date.now() - started, outcome: "error", error });
    throw error;
  }
}

import * as React from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "info" | "warn" | "ok" | "risk";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-paper-sunk text-ink-soft border-line-strong",
  info: "bg-signal-infobg text-signal-info border-signal-info/20",
  warn: "bg-signal-warnbg text-signal-warn border-signal-warn/20",
  ok: "bg-signal-okbg text-signal-ok border-signal-ok/20",
  risk: "bg-signal-riskbg text-signal-risk border-signal-risk/20",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

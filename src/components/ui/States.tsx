import * as React from "react";
import { cn } from "./cn";

/**
 * Loading, empty and error states. The loading copy is always specific about
 * what is happening, and is only shown while that thing is genuinely running
 * (sections 40-42, 51).
 */

export function LoadingState({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-6 text-sm text-ink-mute", className)} role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-pulse-soft"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </span>
      {message}
    </div>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("h-3 rounded-full shimmer", className)} aria-hidden="true" />;
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  compact = false,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-5 py-7" : "px-6 py-12")}>
      {icon && <div className="mb-4 text-ink-faint">{icon}</div>}
      <h3 className="display text-lg text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-mute">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong.",
  body,
  onRetry,
  retryLabel = "Try again",
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-signal-risk/25 bg-signal-riskbg px-5 py-4" role="alert">
      <p className="text-sm font-medium text-signal-risk">{title}</p>
      {body && <p className="mt-1 text-[13px] leading-relaxed text-signal-risk/85">{body}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-signal-risk/30 bg-white px-3 py-1.5 text-[13px] font-medium text-signal-risk hover:bg-white/70"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

/** A non-alarming notice used for capabilities that are not connected. */
export function CapabilityNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-line bg-paper-sunk px-4 py-3">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-ink-mute" aria-hidden="true">
        <circle cx="8" cy="8" r="6.75" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 7.25v4M8 4.75v.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-[13px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { QUICK_STARTS } from "@/domain/taxonomy";
import { ErrorState } from "@/components/ui/States";
import { cn } from "@/components/ui/cn";

const EXAMPLES = [
  "My package never arrived...",
  "I was charged for something I didn't buy...",
  "My flight was cancelled...",
  "The product I bought arrived damaged...",
  "I need help getting a refund...",
  "I received a document I don't understand...",
  "Something is wrong with my bill...",
  "I have a problem and I don't know where to start...",
];

/**
 * Stages shown while a case is being created. Each one names something that is
 * genuinely happening on the server; none of them is decorative (section 51).
 */
const STAGES = ["Understanding what happened...", "Organising your information...", "Setting up your case..."];

export const DRAFT_KEY = "fmp.draft-problem";

export function ProblemComposer({
  authed,
  autoSubmitDraft = false,
  size = "hero",
}: {
  authed: boolean;
  autoSubmitDraft?: boolean;
  size?: "hero" | "compact";
}) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [category, setCategory] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);
  const [stage, setStage] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const areaRef = React.useRef<HTMLTextAreaElement>(null);

  const placeholder = useRotatingPlaceholder(value.length === 0 && !submitting);

  const submit = React.useCallback(
    async (problem: string, categoryHint?: string) => {
      const trimmed = problem.trim();
      if (trimmed.length < 10) {
        setError("Tell us a little more - a sentence or two is enough.");
        return;
      }
      setError(null);

      if (!authed) {
        // Keep what they wrote, then bring them straight back to it.
        try {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ problem: trimmed, categoryHint }));
        } catch {
          // Private browsing; the draft simply isn't carried over.
        }
        router.push("/sign-in?next=/home");
        return;
      }

      setSubmitting(true);
      setStage(0);

      try {
        const response = await fetch("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem: trimmed, categoryHint }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "We couldn't start that case.");

        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* nothing to clear */
        }
        router.push(`/cases/${payload.case.id}`);
      } catch (err) {
        setSubmitting(false);
        setError(err instanceof Error ? err.message : "We couldn't start that case. Please try again.");
      }
    },
    [authed, router],
  );

  // Advance the processing copy while the request is genuinely in flight.
  React.useEffect(() => {
    if (!submitting) return;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1600);
    return () => clearInterval(timer);
  }, [submitting]);

  // Pick up a problem written before signing in.
  React.useEffect(() => {
    if (!autoSubmitDraft || !authed) return;
    let draft: { problem: string; categoryHint?: string } | null = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      draft = raw ? JSON.parse(raw) : null;
    } catch {
      draft = null;
    }
    if (draft?.problem) void submit(draft.problem, draft.categoryHint);
  }, [autoSubmitDraft, authed, submit]);

  if (submitting) {
    return (
      <div className="rounded-3xl border border-line bg-white p-8 shadow-card" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-ink-faint animate-pulse-soft"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </span>
          <p className="text-[15px] font-medium text-ink">{STAGES[stage]}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-mute">
          We&rsquo;re reading what you wrote and turning it into a case you can work from.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={cn(
          "group rounded-3xl border border-line-strong bg-white shadow-card transition-shadow focus-within:shadow-lift",
        )}
      >
        <label htmlFor="problem" className="sr-only">
          What&rsquo;s going on?
        </label>
        <textarea
          ref={areaRef}
          id="problem"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit(value, category);
          }}
          placeholder={placeholder}
          rows={size === "hero" ? 4 : 3}
          maxLength={8000}
          className={cn(
            "w-full resize-none rounded-3xl bg-transparent px-5 pt-5 text-ink placeholder:text-ink-faint focus:outline-none",
            size === "hero"
              ? "min-h-[132px] text-[17px] leading-relaxed sm:min-h-[148px] sm:text-lg"
              : "min-h-[96px] text-[15px] leading-relaxed",
          )}
        />
        <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-1">
          <p className="hidden text-[12.5px] text-ink-faint sm:block">
            {value.length > 0 ? "Press Cmd + Enter to send" : "Write as much or as little as you like."}
          </p>
          <Button
            size={size === "hero" ? "lg" : "md"}
            onClick={() => void submit(value, category)}
            className="ml-auto w-full sm:w-auto"
          >
            Fix My Problem
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState title="We couldn't start that case." body={error} onRetry={() => void submit(value, category)} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {QUICK_STARTS.map((quick) => (
          <button
            key={quick.id}
            type="button"
            onClick={() => {
              setCategory(quick.id === "other" ? undefined : quick.label.split(" ")[0]);
              setValue((current) => (current.length > 0 ? current : quick.prompt));
              areaRef.current?.focus();
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[13px] text-ink-soft",
              "transition-colors hover:border-line-strong hover:bg-paper-sunk hover:text-ink",
            )}
          >
            <span aria-hidden="true">{quick.emoji}</span>
            {quick.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Cycles the example prompts, pausing as soon as the user starts typing. */
function useRotatingPlaceholder(active: boolean): string {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), 3800);
    return () => clearInterval(timer);
  }, [active]);

  return active ? EXAMPLES[index] : "What's going on?";
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { QUICK_STARTS } from "@/domain/taxonomy";
import { ErrorState } from "@/components/ui/States";
import { cn } from "@/components/ui/cn";
import { useI18n } from "@/i18n/client";

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
  const { t } = useI18n();
  const [value, setValue] = React.useState("");
  const [category, setCategory] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);
  const [stage, setStage] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const areaRef = React.useRef<HTMLTextAreaElement>(null);

  /**
   * Stages shown while a case is being created. Each one names something that
   * is genuinely happening on the server; none of them is decorative.
   */
  const stages = React.useMemo(
    () => [t("composer.stage1"), t("composer.stage2"), t("composer.stage3")],
    [t],
  );

  const placeholder = useRotatingPlaceholder(
    t.list("composer.examples"),
    t("composer.idlePlaceholder"),
    value.length === 0 && !submitting,
  );

  const submit = React.useCallback(
    async (problem: string, categoryHint?: string) => {
      const trimmed = problem.trim();
      if (trimmed.length < 10) {
        setError(t("composer.tooShort"));
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
        if (!response.ok) throw new Error(payload.error ?? t("composer.failed"));

        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* nothing to clear */
        }
        router.push(`/cases/${payload.case.id}`);
      } catch (err) {
        setSubmitting(false);
        setError(err instanceof Error ? err.message : t("composer.failed"));
      }
    },
    [authed, router, t],
  );

  // Advance the processing copy while the request is genuinely in flight.
  React.useEffect(() => {
    if (!submitting) return;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 1600);
    return () => clearInterval(timer);
  }, [submitting, stages.length]);

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
          <p className="text-[15px] font-medium text-ink">{stages[stage]}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-mute">{t("composer.processingBody")}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="group rounded-3xl border border-line-strong bg-white shadow-card transition-shadow focus-within:shadow-lift">
        <label htmlFor="problem" className="sr-only">
          {t("composer.label")}
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
            {value.length > 0 ? t("composer.hintTyping") : t("composer.hintEmpty")}
          </p>
          <Button
            size={size === "hero" ? "lg" : "md"}
            onClick={() => void submit(value, category)}
            className="ms-auto w-full sm:w-auto"
          >
            {t("composer.submit")}
            {/* The arrow points the way the language reads. */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="rtl:-scale-x-100">
              <path
                d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState
            title={t("composer.failed")}
            body={error}
            onRetry={() => void submit(value, category)}
            retryLabel={t("common.tryAgain")}
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {QUICK_STARTS.map((quick) => (
          <button
            key={quick.id}
            type="button"
            onClick={() => {
              setCategory(quick.id === "other" ? undefined : quick.category);
              setValue((current) => (current.length > 0 ? current : t(`composer.starters.${quick.id}`)));
              areaRef.current?.focus();
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[13px] text-ink-soft",
              "transition-colors hover:border-line-strong hover:bg-paper-sunk hover:text-ink",
            )}
          >
            <span aria-hidden="true">{quick.emoji}</span>
            {t(`quickStart.${quick.id}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Cycles the example prompts, pausing as soon as the user starts typing. */
function useRotatingPlaceholder(examples: readonly string[], idle: string, active: boolean): string {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!active || examples.length === 0) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % examples.length), 3800);
    return () => clearInterval(timer);
  }, [active, examples.length]);

  if (!active || examples.length === 0) return idle;
  return examples[index % examples.length];
}

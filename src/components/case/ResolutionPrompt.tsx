"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/client";

/**
 * A case is only resolved when the person says the problem is actually fixed.
 * Performing an action is not the same thing.
 */
export function ResolutionPrompt({ onAnswer, busy }: { onAnswer: (resolved: boolean) => Promise<void>; busy: boolean }) {
  const t = useT();

  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-5 shadow-card">
      <p className="text-[15px] font-medium text-ink">{t("resolution.question")}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-mute">{t("resolution.body")}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void onAnswer(true)} disabled={busy}>
          {t("resolution.confirm")}
        </Button>
        <Button variant="secondary" onClick={() => void onAnswer(false)} disabled={busy}>
          {t("resolution.decline")}
        </Button>
      </div>
    </div>
  );
}

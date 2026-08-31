"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";

/**
 * A case is only resolved when the person says the problem is actually fixed
 * (section 65). Performing an action is not the same thing.
 */
export function ResolutionPrompt({ onAnswer, busy }: { onAnswer: (resolved: boolean) => Promise<void>; busy: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-5 shadow-card">
      <p className="text-[15px] font-medium text-ink">Did this solve the problem?</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-mute">
        We&rsquo;ll only close this if you tell us it&rsquo;s actually sorted.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void onAnswer(true)} disabled={busy}>
          Yes, it&rsquo;s fixed
        </Button>
        <Button variant="secondary" onClick={() => void onAnswer(false)} disabled={busy}>
          Not yet
        </Button>
      </div>
    </div>
  );
}

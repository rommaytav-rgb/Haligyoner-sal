"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAME, LOCALE_SHORT, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { cn } from "@/components/ui/cn";

/**
 * The language switcher. Present on every screen, signed in or not, so the
 * choice is never buried in settings.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [pending, setPending] = React.useState<Locale | null>(null);

  async function choose(next: Locale) {
    if (next === locale || pending) return;
    setPending(next);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      // The whole tree re-renders from the server in the new language and
      // direction; nothing in the case record changes.
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      className={cn("inline-flex items-center rounded-full border border-line bg-white p-0.5", className)}
      role="group"
      aria-label={t("common.switchLanguage")}
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            onClick={() => void choose(option)}
            aria-pressed={active}
            aria-label={LOCALE_NAME[option]}
            title={LOCALE_NAME[option]}
            className={cn(
              "min-w-[34px] rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
              active ? "bg-ink text-white" : "text-ink-mute hover:text-ink",
              pending === option && "opacity-60",
            )}
          >
            {LOCALE_SHORT[option]}
          </button>
        );
      })}
    </div>
  );
}

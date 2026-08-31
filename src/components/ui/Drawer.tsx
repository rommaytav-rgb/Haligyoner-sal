"use client";

import * as React from "react";
import { cn } from "./cn";
import { useT } from "@/i18n/client";

/** A side panel on desktop, a bottom sheet on phones. */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button aria-label={t("common.close")} onClick={onClose} className="absolute inset-0 bg-ink/25 animate-fade-in" />
      <aside
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-white shadow-lift animate-fade-up",
          "sm:inset-y-0 sm:start-auto sm:end-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-s-3xl sm:border-s sm:border-t-0",
        )}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-mute hover:bg-paper-sunk hover:text-ink" aria-label={t("common.close")}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4.5 4.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}

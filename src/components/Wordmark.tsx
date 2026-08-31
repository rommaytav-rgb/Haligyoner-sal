import * as React from "react";

/**
 * The product name is a name, not a phrase, so it reads identically in both
 * languages. It still comes from the catalogue rather than being inlined.
 */
export function Wordmark({
  name,
  className = "",
  compactOnMobile = false,
}: {
  name: string;
  className?: string;
  /** Keeps the mark but drops the name on narrow screens, where the header is tight. */
  compactOnMobile?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-white" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span
        dir="ltr"
        className={`text-[15px] font-semibold tracking-[-0.015em] text-ink ${compactOnMobile ? "hidden sm:inline" : ""}`}
      >
        {name}
      </span>
    </span>
  );
}

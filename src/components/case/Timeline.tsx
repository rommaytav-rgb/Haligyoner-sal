"use client";

import type { TimelineEvent } from "@/domain/types";
import { useI18n } from "@/i18n/client";
import { renderSystemText } from "@/i18n/system-text";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const { t, relativeTime } = useI18n();

  return (
    // The rail sits on the inline-start edge, so it moves to the right in Hebrew.
    <ol className="relative space-y-6 ps-6">
      <span className="absolute start-[5px] top-2 h-[calc(100%-1rem)] w-px bg-line" aria-hidden="true" />
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className="absolute -start-6 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-white bg-line-strong"
            aria-hidden="true"
          />
          <p dir="auto" className="text-[14px] font-medium leading-snug text-ink">
            {renderSystemText(t, event.titleText, event.title)}
          </p>
          {(event.descriptionText || event.description) && (
            <p dir="auto" className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
              {renderSystemText(t, event.descriptionText, event.description)}
            </p>
          )}
          <p className="mt-1 text-[12.5px] text-ink-faint">
            {t(`timelineSource.${event.source}`)} &middot; {relativeTime(event.date ?? event.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

import type { TimelineEvent } from "@/domain/types";
import { relativeTime } from "@/lib/format";

const SOURCE_LABEL: Record<TimelineEvent["source"], string> = {
  USER: "You",
  DOCUMENT: "From a document",
  SYSTEM: "Fix My Problem",
  EXTERNAL: "External",
  AI_INFERENCE: "Read from your description",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-6 pl-6">
      <span className="absolute left-[5px] top-2 h-[calc(100%-1rem)] w-px bg-line" aria-hidden="true" />
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className="absolute -left-6 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-white bg-line-strong"
            aria-hidden="true"
          />
          <p className="text-[14px] font-medium leading-snug text-ink">{event.title}</p>
          {event.description && (
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{event.description}</p>
          )}
          <p className="mt-1 text-[12.5px] text-ink-faint">
            {SOURCE_LABEL[event.source]} &middot; {relativeTime(event.date ?? event.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

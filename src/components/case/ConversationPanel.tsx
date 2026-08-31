"use client";

import * as React from "react";
import type { CaseMessage } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { relativeTime } from "@/lib/format";

/**
 * Case chat (section 29). The transcript is a view onto the case, not the case
 * itself - each assistant turn shows what it actually changed in the record.
 */
export function ConversationPanel({
  messages,
  sending,
  error,
  onSend,
  onRetry,
  disabled,
}: {
  messages: CaseMessage[];
  sending: boolean;
  error: string | null;
  onSend: (content: string) => Promise<void>;
  onRetry: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, sending]);

  async function send() {
    const text = value.trim();
    if (!text || sending) return;
    setValue("");
    await onSend(text);
  }

  return (
    <div className="flex flex-col">
      <ul className="space-y-4">
        {messages.map((message) => (
          <li key={message.id} className={message.role === "USER" ? "flex justify-end" : ""}>
            <div className={message.role === "USER" ? "max-w-[85%]" : "max-w-[92%]"}>
              <div
                className={
                  message.role === "USER"
                    ? "rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[14.5px] leading-relaxed text-white"
                    : "rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 text-[14.5px] leading-relaxed text-ink shadow-card"
                }
              >
                <p className="whitespace-pre-line">{message.content}</p>
              </div>

              {message.appliedChanges && message.appliedChanges.length > 0 && (
                <ul className="mt-2 space-y-1 pl-1">
                  {message.appliedChanges.map((change) => (
                    <li key={change} className="flex items-start gap-1.5 text-[12.5px] text-ink-mute">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-1 shrink-0" aria-hidden="true">
                        <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {change}
                    </li>
                  ))}
                </ul>
              )}

              <p
                className={`mt-1 text-[12px] text-ink-faint ${message.role === "USER" ? "text-right" : ""}`}
              >
                {relativeTime(message.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {sending && <LoadingState message="Working through what you said..." />}
      {error && (
        <div className="mt-4">
          <ErrorState title="I lost track of that last step." body={error} onRetry={onRetry} />
        </div>
      )}
      <div ref={endRef} />

      <div className="sticky bottom-0 mt-6 -mx-1 bg-gradient-to-t from-paper-warm via-paper-warm to-transparent px-1 pb-1 pt-4">
        <div className="rounded-2xl border border-line-strong bg-white shadow-card transition-shadow focus-within:shadow-lift">
          <label htmlFor="case-message" className="sr-only">
            Add to this case
          </label>
          <textarea
            id="case-message"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send();
            }}
            rows={2}
            disabled={disabled}
            placeholder={disabled ? "This case is closed." : "Tell us anything new - they replied, you found a receipt, we got something wrong..."}
            className="min-h-[76px] w-full resize-none rounded-2xl bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:text-ink-faint"
          />
          <div className="flex justify-end px-3 pb-3">
            <Button size="sm" onClick={() => void send()} loading={sending} disabled={disabled || value.trim().length === 0}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

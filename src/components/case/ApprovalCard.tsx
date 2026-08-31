"use client";

import * as React from "react";
import type { ActionStep } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/States";

/**
 * The approval gate (section 24).
 *
 * Before anything consequential happens the user sees exactly what would
 * happen, who would receive it, and what information would leave their hands -
 * with the message itself in full, editable.
 */
export function ApprovalCard({
  action,
  onApprove,
  onCancel,
}: {
  action: ActionStep;
  onApprove: (editedBody?: string) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(action.draft?.body ?? "");
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const draft = action.draft;
  const edited = body !== (draft?.body ?? "");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-signal-warn/25 bg-signal-warnbg/45 p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-signal-warn">Needs your approval</p>
      <h3 className="mt-2 text-[16px] font-semibold leading-snug text-ink">{action.title}</h3>
      <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">{action.description}</p>

      {draft && (
        <div className="mt-4 space-y-4 rounded-xl border border-line bg-white p-4">
          <Row label="What will happen">
            {action.toolAvailable === false
              ? "Nothing is sent from here. You'll approve the wording, then send it yourself."
              : `We'll send this ${draft.channel.toLowerCase()} on your behalf once you approve it.`}
          </Row>
          <Row label="Who will receive it">{draft.recipient || "You'll choose the recipient when you send it."}</Row>
          <Row label="Information being shared">
            {draft.sharedInformation.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {draft.sharedInformation.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-ink-faint">
                      &middot;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              "Only what's written below."
            )}
          </Row>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">The message</p>
            {draft.subject && <p className="mt-1.5 text-[14px] font-medium text-ink">Subject: {draft.subject}</p>}
            {editing ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-2 w-full rounded-xl border border-line-strong bg-white px-3.5 py-3 text-[14px] leading-relaxed text-ink focus:shadow-focus focus:outline-none"
              />
            ) : (
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-soft">{body}</pre>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorState title="We couldn't do that." body={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => setConfirming(true)} disabled={busy}>
          Approve
        </Button>
        <Button variant="secondary" onClick={() => setEditing((v) => !v)} disabled={busy}>
          {editing ? "Done editing" : "Edit"}
        </Button>
        <Button variant="ghost" onClick={() => void run(onCancel)} disabled={busy}>
          Cancel
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Approve this?"
        description={
          action.toolAvailable === false
            ? "We'll mark this approved and give you the final text to send. Nothing leaves Fix My Problem."
            : "Once you approve, this will be sent as written."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Not yet
            </Button>
            <Button onClick={() => void run(() => onApprove(edited ? body : undefined))} loading={busy}>
              Yes, approve
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          {edited ? "Your edited version is what will be used." : "The message above is what will be used."}
        </p>
      </Modal>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{label}</p>
      <div className="mt-1 text-[14px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

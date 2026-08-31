"use client";

import * as React from "react";
import type { ActionStep } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/States";
import { useT } from "@/i18n/client";

/**
 * The approval gate.
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
  const t = useT();
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(action.draft?.body ?? "");
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const draft = action.draft;
  const edited = body !== (draft?.body ?? "");
  // Whether anything can actually carry this out from here. The copy below is
  // driven by this, never by the ability to write a draft.
  const deliverable = action.toolAvailable !== false;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("approval.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-signal-warn/25 bg-signal-warnbg/45 p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-signal-warn">{t("approval.label")}</p>
      <h3 dir="auto" className="mt-2 text-[16px] font-semibold leading-snug text-ink">
        {action.title}
      </h3>
      <p dir="auto" className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">
        {action.description}
      </p>

      {draft && (
        <div className="mt-4 space-y-4 rounded-xl border border-line bg-white p-4">
          <Row label={t("approval.whatWillHappen")}>
            {deliverable
              ? t("approval.whatWillHappenAuto", { channel: t(`channel.${draft.channel}`) })
              : t("approval.whatWillHappenManual")}
          </Row>
          <Row label={t("approval.whoReceives")}>
            <span dir="auto" className="bidi-isolate">
              {draft.recipient || t("approval.whoReceivesUnknown")}
            </span>
          </Row>
          <Row label={t("approval.infoShared")}>
            {draft.sharedInformation.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {draft.sharedInformation.map((item) => (
                  <li key={item} dir="auto" className="flex gap-2">
                    <span aria-hidden="true" className="text-ink-faint">
                      &middot;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              t("approval.infoSharedNone")
            )}
          </Row>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              {t("approval.message")}
            </p>
            {draft.subject && (
              <p className="mt-1.5 text-[14px] font-medium text-ink">
                {t("approval.messageSubject")}{" "}
                <span dir="auto" className="bidi-isolate">
                  {draft.subject}
                </span>
              </p>
            )}
            {editing ? (
              <textarea
                value={body}
                dir="auto"
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-2 w-full rounded-xl border border-line-strong bg-white px-3.5 py-3 text-[14px] leading-relaxed text-ink focus:shadow-focus focus:outline-none"
              />
            ) : (
              <pre dir="auto" className="mt-2 whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-soft">
                {body}
              </pre>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorState title={t("approval.failed")} body={error} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => setConfirming(true)} disabled={busy}>
          {t("common.approve")}
        </Button>
        <Button variant="secondary" onClick={() => setEditing((v) => !v)} disabled={busy}>
          {editing ? t("common.doneEditing") : t("common.edit")}
        </Button>
        <Button variant="ghost" onClick={() => void run(onCancel)} disabled={busy}>
          {t("common.cancel")}
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("approval.confirmTitle")}
        description={deliverable ? t("approval.confirmBodyAuto") : t("approval.confirmBodyManual")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              {t("common.notYet")}
            </Button>
            <Button onClick={() => void run(() => onApprove(edited ? body : undefined))} loading={busy}>
              {t("approval.confirmButton")}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          {edited ? t("approval.confirmEdited") : t("approval.confirmOriginal")}
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

"use client";

import * as React from "react";
import type { Evidence } from "@/domain/types";
import { EvidenceCard } from "./EvidenceCard";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useT } from "@/i18n/client";

export function EvidencePanel({
  caseId,
  evidence,
  onUploaded,
}: {
  caseId: string;
  evidence: Evidence[];
  onUploaded: () => Promise<void>;
}) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/cases/${caseId}/evidence`, { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("evidence.uploadFailed"));

      if (payload.injectionObserved) setNotice(payload.injectionObserved as string);
      else if (payload.factsAdded > 0) {
        setNotice(t.plural("evidence.confirmedDetails", payload.factsAdded as number));
      }
      await onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("evidence.uploadFailed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(evidenceId: string) {
    await fetch(`/api/cases/${caseId}/evidence/${evidenceId}`, { method: "DELETE" });
    await onUploaded();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-mute">{t("evidence.intro")}</p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,.doc,.docx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
          {t("evidence.add")}
        </Button>
      </div>

      {uploading && <LoadingState message={t("evidence.uploading")} />}
      {notice && (
        <p dir="auto" className="mt-4 rounded-xl border border-line bg-paper-sunk px-4 py-3 text-[13.5px] leading-relaxed text-ink-soft">
          {notice}
        </p>
      )}
      {error && (
        <div className="mt-4">
          <ErrorState
            title={t("evidence.uploadFailed")}
            body={error}
            onRetry={() => inputRef.current?.click()}
            retryLabel={t("common.tryAgain")}
          />
        </div>
      )}

      {evidence.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-white shadow-card">
          <EmptyState
            title={t("evidence.emptyTitle")}
            body={t("evidence.emptyBody")}
            action={
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                {t("evidence.add")}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {evidence.map((item) => (
            <EvidenceCard key={item.id} item={item} caseId={caseId} onRemove={() => void remove(item.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

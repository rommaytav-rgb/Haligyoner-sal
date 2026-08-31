"use client";

import * as React from "react";
import type { Case, Fact } from "@/domain/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { useT } from "@/i18n/client";

/**
 * "What we know" and "What's missing".
 *
 * The distinction between what the user told us and what a document confirms is
 * shown on every row, and never blurred.
 */
const VERIFICATION_TONE: Record<Fact["verification"], BadgeTone> = {
  USER_REPORTED: "neutral",
  DOCUMENT_VERIFIED: "ok",
  SYSTEM_VERIFIED: "ok",
  EXTERNAL_SOURCE: "info",
  INFERRED: "warn",
  UNKNOWN: "warn",
};

export function KnownPanel({
  facts,
  record,
  onRetract,
}: {
  facts: Fact[];
  record: Case;
  onRetract: (factId: string) => Promise<void>;
}) {
  const t = useT();
  const openQuestions = record.unknowns.filter((u) => !u.resolved);
  const answered = record.unknowns.filter((u) => u.resolved);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {t("caseView.known")}
        </h2>
        {facts.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-line bg-white shadow-card">
            <EmptyState compact title={t("caseView.knownEmptyTitle")} body={t("caseView.knownEmptyBody")} />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {facts.map((fact) => (
              <li key={fact.id} className="group rounded-xl border border-line bg-white px-4 py-3 shadow-card">
                <p dir="auto" className="text-[14px] leading-relaxed text-ink">
                  {fact.statement}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={VERIFICATION_TONE[fact.verification]}>{t(`verification.${fact.verification}`)}</Badge>
                  <button
                    onClick={() => void onRetract(fact.id)}
                    className="ms-auto text-[12.5px] text-ink-faint opacity-0 transition-opacity hover:text-signal-risk focus:opacity-100 group-hover:opacity-100"
                  >
                    {t("caseView.thatsNotRight")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {t("caseView.missing")}
        </h2>
        {openQuestions.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-line bg-white shadow-card">
            <EmptyState compact title={t("caseView.missingEmptyTitle")} body={t("caseView.missingEmptyBody")} />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {openQuestions.map((unknown) => (
              <li key={unknown.id} className="rounded-xl border border-line bg-white px-4 py-3 shadow-card">
                <p dir="auto" className="text-[14px] leading-relaxed text-ink">
                  {unknown.question}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">
                  <span className="font-medium text-ink-soft">{t("caseView.whyAsking")} </span>
                  <span dir="auto" className="bidi-isolate">
                    {unknown.reason}
                  </span>
                </p>
                {unknown.importance === "REQUIRED" && (
                  <Badge tone="warn" className="mt-2">
                    {t("caseView.needed")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {answered.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-[13px] text-ink-mute hover:text-ink">
              {t("caseView.answeredQuestions", { count: answered.length })}
            </summary>
            <ul className="mt-2 space-y-2">
              {answered.map((u) => (
                <li key={u.id} className="rounded-xl border border-line bg-paper-sunk px-4 py-3">
                  <p dir="auto" className="text-[13.5px] text-ink-soft">
                    {u.question}
                  </p>
                  {u.answer && (
                    <p dir="auto" className="mt-1 text-[13.5px] text-ink">
                      {u.answer}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

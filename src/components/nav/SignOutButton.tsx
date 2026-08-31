"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useT } from "@/i18n/client";

export function SignOutButton() {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = React.useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/sign-out", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
      disabled={busy}
      className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-mute transition-colors hover:bg-paper-sunk hover:text-ink disabled:opacity-60"
    >
      {t("common.signOut")}
    </button>
  );
}

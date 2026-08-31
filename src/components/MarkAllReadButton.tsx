"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/client";

export function MarkAllReadButton() {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications/read", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      {t("notifications.markAllRead")}
    </Button>
  );
}

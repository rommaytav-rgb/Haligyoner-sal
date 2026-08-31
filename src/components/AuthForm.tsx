"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/States";
import { useT } from "@/i18n/client";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ next }: { next?: string }) {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = React.useState<Mode>("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signingIn = mode === "sign-in";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${signingIn ? "sign-in" : "sign-up"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          signingIn ? { email, password } : { email, password, displayName: displayName || undefined },
        ),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("errors.generic"));

      router.replace(next && next.startsWith("/") ? next : "/home");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : t("errors.generic"));
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="display text-[30px] text-ink">{signingIn ? t("auth.welcomeBack") : t("auth.createTitle")}</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-mute">
        {signingIn ? t("auth.welcomeBody") : t("auth.createBody")}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {!signingIn && (
          <Input
            label={t("auth.name")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            placeholder={t("auth.nameOptional")}
          />
        )}
        <Input
          label={t("auth.email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={t("auth.emailPlaceholder")}
          // An address is always read left to right, whatever the interface language.
          dir="ltr"
          className="text-start"
        />
        <Input
          label={t("auth.password")}
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={signingIn ? "current-password" : "new-password"}
          hint={signingIn ? undefined : t("auth.passwordHint")}
          dir="ltr"
          className="text-start"
        />

        {error && <ErrorState title={t("auth.failed")} body={error} />}

        <Button type="submit" size="lg" fullWidth loading={busy}>
          {signingIn ? t("common.signIn") : t("auth.createAccount")}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-mute">
        {signingIn ? t("auth.newHere") : t("auth.haveAccount")}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(signingIn ? "sign-up" : "sign-in");
            setError(null);
          }}
          className="font-medium text-ink underline underline-offset-4 hover:text-ink-soft"
        >
          {signingIn ? t("auth.switchToCreate") : t("auth.switchToSignIn")}
        </button>
      </p>
    </div>
  );
}

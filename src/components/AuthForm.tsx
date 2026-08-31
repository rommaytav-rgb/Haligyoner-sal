"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/States";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode === "sign-in" ? "sign-in" : "sign-up"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "sign-in" ? { email, password } : { email, password, displayName: displayName || undefined },
        ),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "That didn't work.");

      router.replace(next && next.startsWith("/") ? next : "/home");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="display text-[30px] text-ink">
        {mode === "sign-in" ? "Welcome back." : "Let's get you set up."}
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-mute">
        {mode === "sign-in"
          ? "Sign in to pick up where you left off."
          : "Your cases stay private to you. We only ask for what we need."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "sign-up" && (
          <Input
            label="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            placeholder="Optional"
          />
        )}
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          hint={mode === "sign-up" ? "At least 10 characters." : undefined}
        />

        {error && <ErrorState title="We couldn't sign you in." body={error} />}

        <Button type="submit" size="lg" fullWidth loading={busy}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-mute">
        {mode === "sign-in" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
          }}
          className="font-medium text-ink underline underline-offset-4 hover:text-ink-soft"
        >
          {mode === "sign-in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}

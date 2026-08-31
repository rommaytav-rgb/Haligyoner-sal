import * as React from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";
import { initials } from "@/lib/format";

/**
 * The authenticated frame: a quiet top bar on desktop, a bottom bar on phones.
 * Four destinations, no more (section 9).
 */
export function AppShell({
  children,
  user,
  unread,
}: {
  children: React.ReactNode;
  user: { email: string; displayName?: string };
  unread: number;
}) {
  return (
    <div className="min-h-dvh pb-[76px] sm:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-paper-warm/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-5 py-3.5 sm:px-8">
          <Link href="/home" aria-label="Fix My Problem home">
            <Wordmark />
          </Link>
          <nav className="ml-auto hidden sm:block">
            <NavLinks unread={unread} variant="top" />
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <span
              title={user.email}
              className="grid h-8 w-8 place-items-center rounded-full bg-paper-sunk text-[12px] font-semibold text-ink-soft"
            >
              {initials(user.displayName || user.email)}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur sm:hidden">
        <NavLinks unread={unread} variant="bottom" />
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { useT } from "@/i18n/client";

const ITEMS = [
  { href: "/home", labelKey: "nav.home", shortKey: "nav.home", icon: HomeIcon },
  { href: "/cases", labelKey: "nav.cases", shortKey: "nav.casesShort", icon: CasesIcon },
  { href: "/notifications", labelKey: "nav.notifications", shortKey: "nav.notificationsShort", icon: BellIcon },
  { href: "/settings", labelKey: "nav.settings", shortKey: "nav.settings", icon: GearIcon },
] as const;

export function NavLinks({ unread, variant }: { unread: number; variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const t = useT();

  if (variant === "top") {
    return (
      <ul className="flex items-center gap-1">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                  active ? "bg-paper-sunk text-ink" : "text-ink-mute hover:text-ink",
                )}
              >
                {t(item.labelKey)}
                {item.href === "/notifications" && unread > 0 && <Dot label={t("common.unreadNotifications")} />}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="mx-auto flex max-w-md items-stretch justify-around pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-ink" : "text-ink-faint",
              )}
            >
              <span className="relative">
                <Icon active={active} />
                {item.href === "/notifications" && unread > 0 && (
                  <span
                    className="absolute -end-1 -top-0.5 h-2 w-2 rounded-full bg-signal-risk ring-2 ring-white"
                    aria-label={t("common.unreadNotifications")}
                  />
                )}
              </span>
              {t(item.shortKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Dot({ label }: { label: string }) {
  return <span className="absolute end-1.5 top-1 h-1.5 w-1.5 rounded-full bg-signal-risk" aria-label={label} />;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5L10 3.5l6.5 5v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />
    </svg>
  );
}

function CasesIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="3" y="5.5" width="14" height="11" rx="2"
        stroke="currentColor" strokeWidth="1.5"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0}
      />
      <path d="M7.5 5.5V4.5a1 1 0 011-1h3a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 8.5a4.5 4.5 0 019 0c0 3 1 4.5 1 4.5h-11s1-1.5 1-4.5z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0}
      />
      <path d="M8.5 15.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
      <path
        d="M10 3v1.5M10 15.5V17M17 10h-1.5M4.5 10H3M14.95 5.05l-1.06 1.06M6.11 13.89l-1.06 1.06M14.95 14.95l-1.06-1.06M6.11 6.11L5.05 5.05"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

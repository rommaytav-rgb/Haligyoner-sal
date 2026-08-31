"use client";

import * as React from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
      <div className="flex min-w-max gap-1 border-b border-line">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative -mb-px whitespace-nowrap px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
                selected ? "text-ink" : "text-ink-mute hover:text-ink-soft",
              )}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                    selected ? "bg-ink text-white" : "bg-paper-sunk text-ink-mute",
                  )}
                >
                  {item.count}
                </span>
              )}
              {selected && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

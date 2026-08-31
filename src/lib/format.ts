export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = now.getTime() - then;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return diff >= 0 ? "just now" : "in a moment";
  const fmt = (value: number, unit: string) => {
    const n = Math.round(value);
    const label = `${n} ${unit}${n === 1 ? "" : "s"}`;
    return diff >= 0 ? `${label} ago` : `in ${label}`;
  };
  if (abs < hour) return fmt(abs / minute, "minute");
  if (abs < day) return fmt(abs / hour, "hour");
  if (abs < 30 * day) return fmt(abs / day, "day");
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.split("@")[0] ?? "";
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
}

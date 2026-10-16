const FALLBACK_TIMEZONE = "Asia/Kolkata";

const OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

function format(date: Date, timeZone: string): string {
  return date.toLocaleString("en-IN", { ...OPTIONS, timeZone });
}

/**
 * Format an ISO timestamp (the API sends it with the app's UTC offset) in the app timezone.
 * Returns "" for an empty, missing or unparseable date. An invalid
 * NEXT_PUBLIC_APP_TIMEZONE falls back to Asia/Kolkata instead of throwing.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const timeZone = process.env.NEXT_PUBLIC_APP_TIMEZONE || FALLBACK_TIMEZONE;
  try {
    return format(date, timeZone);
  } catch {
    return format(date, FALLBACK_TIMEZONE);
  }
}

/** "42s", "9 min 12s", "1 h 3 min". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60}s` : `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

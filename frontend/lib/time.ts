/** Format an ISO timestamp (the API sends it with the app's UTC offset) in the app timezone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

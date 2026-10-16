import type { JobSummary } from "@/lib/api";
import { formatDuration } from "@/lib/time";

/**
 * The one-line answer to "did everyone get it?", with the exceptions after it.
 * Skipped repeats are left out of "of N": they were never meant to receive one.
 */
export function DeliverySummary({
  summary,
  dryRun,
  status,
}: {
  summary: JobSummary;
  dryRun: boolean;
  status: string;
}) {
  const attempted = summary.total - summary.skipped;
  // The page loads the job once, so a live job's numbers are a snapshot.
  const inProgress = status === "pending" || status === "running";
  const done = dryRun ? summary.generated : summary.delivered;

  let headline: string;
  if (attempted === 0) {
    headline = `Nothing to ${dryRun ? "generate" : "send"}`;
  } else if (inProgress) {
    headline = dryRun
      ? `In progress: ${done} of ${attempted} certificates generated so far`
      : `In progress: ${done} of ${attempted} delivered so far`;
  } else if (dryRun) {
    headline = `${done} of ${attempted} certificates generated`;
  } else {
    headline = `${done} of ${attempted} delivered${
      summary.delivered_pct !== null ? ` (${summary.delivered_pct}%)` : ""
    }`;
  }

  const details = [
    summary.failed > 0 && `${summary.failed} failed`,
    summary.bounced > 0 && `${summary.bounced} bounced`,
    summary.invalid > 0 &&
      `${summary.invalid} invalid address${summary.invalid > 1 ? "es" : ""}`,
    summary.skipped > 0 && `${summary.skipped} skipped`,
    summary.not_processed > 0 &&
      `${summary.not_processed} ${inProgress ? "not yet processed" : "not processed"}`,
    summary.retries > 0 &&
      `${summary.retries} retried send${summary.retries > 1 ? "s" : ""}`,
    !inProgress &&
      summary.duration_seconds !== null &&
      `took ${formatDuration(summary.duration_seconds)}`,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-[15px] font-medium">{headline}</p>
      {details.length > 0 && (
        <p className="mt-1 text-[13px] text-muted-foreground">{details.join(" · ")}</p>
      )}
    </div>
  );
}

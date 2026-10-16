import type { JobSummary } from "@/lib/api";
import { formatDuration } from "@/lib/time";

/**
 * The one-line answer to "did everyone get it?", with the exceptions after it.
 * Skipped repeats are left out of "of N": they were never meant to receive one.
 */
export function DeliverySummary({
  summary,
  dryRun,
}: {
  summary: JobSummary;
  dryRun: boolean;
}) {
  const attempted = summary.total - summary.skipped;
  const headline = dryRun
    ? `${summary.generated} of ${summary.total} certificates generated`
    : `${summary.delivered} of ${attempted} delivered${
        summary.delivered_pct !== null ? ` (${summary.delivered_pct}%)` : ""
      }`;

  const details = [
    summary.failed > 0 && `${summary.failed} failed`,
    summary.bounced > 0 && `${summary.bounced} bounced`,
    summary.invalid > 0 &&
      `${summary.invalid} invalid address${summary.invalid > 1 ? "es" : ""}`,
    summary.skipped > 0 && `${summary.skipped} skipped`,
    summary.not_processed > 0 && `${summary.not_processed} not processed`,
    summary.retries > 0 &&
      `${summary.retries} retried send${summary.retries > 1 ? "s" : ""}`,
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

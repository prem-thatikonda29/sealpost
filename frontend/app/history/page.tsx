"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listJobs, clearJobs, type Job } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useNotify } from "@/lib/notify";
import { formatDateTime } from "@/lib/time";

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const notify = useNotify();

  const load = () =>
    listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleClear = async () => {
    try {
      await clearJobs();
    } catch (e: any) {
      // A 409 means something is still running, and the API says which way to
      // resolve it. Nothing was deleted.
      notify.error(
        "Could not clear history",
        e?.response?.data?.detail ?? e?.message
      );
      return;
    }
    notify.success("History cleared");
    load();
  };

  const active = jobs.filter((j) => j.status === "running" || j.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        subtitle="Past certificate jobs"
        actions={
          jobs.length > 0 ? (
            <ConfirmDialog
              triggerClassName="border border-border bg-card px-2.5 text-foreground hover:border-hair-hover hover:bg-surface-raised"
              title={`Delete all ${jobs.length} jobs?`}
              description={
                <>
                  Every job record, every row, and every certificate they
                  generated are removed. This cannot be undone.
                  {active.length > 0 && (
                    <>
                      {" "}
                      <span className="font-medium text-foreground">
                        {active.length}{" "}
                        {active.length === 1 ? "job is" : "jobs are"} still
                        running
                      </span>{" "}
                      — clearing will be refused until{" "}
                      {active.length === 1 ? "it finishes" : "they finish"}.
                    </>
                  )}
                </>
              }
              confirmLabel="Delete everything"
              busyLabel="Deleting…"
              onConfirm={handleClear}
            >
              Clear history
            </ConfirmDialog>
          ) : undefined
        }
      />

      {loading && (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="rounded-lg border border-dashed border-hair-hover px-6 py-16 text-center">
          <p className="font-serif text-lg tracking-[-0.02em] text-foreground">
            No jobs yet
          </p>
          <p className="measure mx-auto mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Every run is recorded here with a per-row outcome — what was sent,
            what bounced, what failed and why. Open one to re-send to whoever
            missed out, or to export the records.
          </p>
          <Link
            href="/run"
            className="mt-5 inline-block text-[13px] font-medium text-terra-ink underline underline-offset-4"
          >
            Go to Run
          </Link>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/history/${job.id}`}
              className="flex items-center justify-between gap-4 p-4 transition-colors duration-150 hover:bg-surface-raised"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {job.event_name ?? "One-off job"}
                </p>
                <p className="mt-1 font-mono text-[12px] text-muted-foreground tabular">
                  {formatDateTime(job.created_at)}
                  {job.dry_run && (
                    <span className="ml-2 font-sans italic">dry run</span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                <span className="font-mono text-[12px] text-muted-foreground tabular">
                  {job.sent_count}/{job.total_rows} sent
                  {job.bounced_count > 0 && ` · ${job.bounced_count} bounced`}
                  {job.invalid_count > 0 && ` · ${job.invalid_count} invalid`}
                  {job.failed_count > 0 && ` · ${job.failed_count} failed`}
                </span>
                <StatusBadge status={job.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

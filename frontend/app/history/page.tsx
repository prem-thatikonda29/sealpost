"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listJobs, type Job } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="History" subtitle="Past certificate jobs" />

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
                  {new Date(job.created_at).toLocaleString()}
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

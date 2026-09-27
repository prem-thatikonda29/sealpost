"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listJobs, type Job } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-green-100 text-green-800 border-green-300",
  running: "bg-blue-100 text-blue-800 border-blue-300",
  failed: "bg-red-100 text-red-800 border-red-300",
  pending: "bg-muted text-muted-foreground border-border",
};

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listJobs().then(setJobs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Past certificate jobs</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && jobs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No jobs yet. Run your first job from the{" "}
            <Link href="/run" className="underline">Run</Link> page.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <Link key={job.id} href={`/history/${job.id}`} className="block group">
            <Card className="transition-colors group-hover:bg-muted/40">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {job.event_name ?? "One-off job"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(job.created_at).toLocaleString()}
                      {job.dry_run && (
                        <span className="ml-2 italic">dry run</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {job.sent_count}/{job.total_rows} sent
                      {job.bounced_count > 0 && ` · ${job.bounced_count} bounced`}
                      {job.invalid_count > 0 && ` · ${job.invalid_count} invalid`}
                      {job.failed_count > 0 && ` · ${job.failed_count} failed`}
                    </span>
                    <span
                      className={`text-xs border rounded px-1.5 py-0.5 ${STATUS_COLORS[job.status] ?? STATUS_COLORS.pending}`}
                    >
                      {job.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

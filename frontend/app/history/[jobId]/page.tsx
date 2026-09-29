"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getJob, type Job, type JobRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function downloadCsv(rows: JobRow[], jobId: string) {
  const header = ["#", "Name", "Email", "Status", "Error"];
  const lines = rows.map((r) => [
    r.row_index + 1,
    `"${r.name.replace(/"/g, '""')}"`,
    r.email,
    r.status,
    `"${(r.error_message ?? "").replace(/"/g, '""')}"`,
  ]);
  const csv = [header, ...lines].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job_${jobId.slice(0, 8)}_results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJob(jobId)
      .then(setJob)
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Link
          href="/history"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← History
        </Link>
        <div className="rounded-lg border border-dashed border-hair-hover px-6 py-16 text-center">
          <p className="font-serif text-lg tracking-[-0.02em] text-foreground">
            Job not found
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            It may have been removed, or the link is incomplete.
          </p>
        </div>
      </div>
    );
  }

  const rows = job.rows ?? [];

  const summary = [
    { label: "Sent", value: job.sent_count, tone: "text-sage-ink" },
    { label: "Failed", value: job.failed_count, tone: "text-rose-ink" },
    { label: "Invalid", value: job.invalid_count, tone: "text-amber-ink" },
    { label: "Bounced", value: job.bounced_count, tone: "text-terra-ink" },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/history"
        className="inline-block text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← History
      </Link>

      <PageHeader
        title={job.event_name ?? "One-off job"}
        subtitle={`${new Date(job.created_at).toLocaleString()}${job.dry_run ? " · dry run" : ""}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(rows, job.id)}
            disabled={rows.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 hairline-grid">
        {summary.map(({ label, value, tone }) => (
          <div key={label} className="px-4 py-5">
            <p className={`font-mono text-2xl leading-none tabular ${tone}`}>
              {value}
            </p>
            <p className="label-mono mt-2">{label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hair-hover px-6 py-12 text-center">
          <p className="text-[13px] text-muted-foreground">
            This job has no recorded rows.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted">
                <TableHead className="w-14">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-[12px] text-muted-foreground tabular">
                    {row.row_index + 1}
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="font-mono text-[12px]">
                    {row.email}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="max-w-[24ch] truncate text-[13px] text-muted-foreground">
                    {row.error_message ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

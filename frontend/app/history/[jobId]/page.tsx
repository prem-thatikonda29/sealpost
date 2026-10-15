"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getJob, deleteJob, jobDownloadUrl, type Job, type JobRow } from "@/lib/api";
import { downloadCsv, rowsToRecordCsv } from "@/lib/csv";
import { EmailText, EmailToggle } from "@/components/EmailToggle";
import { ResendPanel } from "@/components/ResendPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useNotify } from "@/lib/notify";
import { formatDateTime } from "@/lib/time";
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

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const notify = useNotify();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmails, setShowEmails] = useState(false);

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

  /* Everything that didn't get a certificate. A dry run's rows are "skipped",
     which means nothing was attempted — not that it failed — so they are not
     here. */
  const undelivered = rows.filter((r) =>
    ["failed", "invalid_domain", "bounced"].includes(r.status)
  );

  const handleDelete = async () => {
    try {
      await deleteJob(job.id);
    } catch (e: any) {
      // A 409 means the job is still running and nothing was deleted.
      notify.error(
        "Could not delete the job",
        e?.response?.data?.detail ?? e?.message
      );
      return;
    }
    notify.success(`Deleted "${job.event_name ?? "job"}"`);
    router.push("/history");
  };

  const summary = [
    // A generate-only run sent nothing, so labelling its rows "Sent" would be
    // false however many there are. total_rows is what it produced.
    job.dry_run
      ? { label: "Generated", value: job.total_rows, tone: "text-sage-ink" }
      : { label: "Sent", value: job.sent_count, tone: "text-sage-ink" },
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
        subtitle={`${formatDateTime(job.created_at)}${job.dry_run ? " · dry run" : ""}`}
        actions={
          <div className="flex gap-2">
            {job.certificates_available && (
              <a
                href={jobDownloadUrl(job.id)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 text-[13px] font-medium transition-colors duration-150 hover:border-hair-hover hover:bg-surface-raised"
              >
                Download .zip
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  rowsToRecordCsv(rows),
                  `job_${job.id.slice(0, 8)}_records.csv`
                )
              }
              disabled={rows.length === 0}
            >
              Export all {rows.length}
            </Button>
            {undelivered.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    rowsToRecordCsv(undelivered),
                    `job_${job.id.slice(0, 8)}_undelivered.csv`
                  )
                }
              >
                Export {undelivered.length} undelivered
              </Button>
            )}
            <ConfirmDialog
              triggerClassName="border border-border bg-card text-destructive hover:bg-rose hover:text-rose-ink"
              title={`Delete this job?`}
              description={
                <>
                  {rows.length} row{rows.length === 1 ? "" : "s"} and the{" "}
                  certificates they generated are removed from disk. This cannot
                  be undone.
                  {job.status === "running" &&
                    " This job is still running — deleting will be refused until it finishes."}
                </>
              }
              confirmLabel="Delete job"
              busyLabel="Deleting…"
              onConfirm={handleDelete}
            >
              Delete
            </ConfirmDialog>
          </div>
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

      {/* Keyed by job so the form resets when you open a different one. Moving
          between two job pages reuses this component, and the subject and body
          are seeded from the snapshot — without the key they would carry the
          previous job's message across. */}
      <ResendPanel key={job.id} job={job} rows={rows} showEmails={showEmails} />

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
                <TableHead>
                  <span className="inline-flex items-center gap-2">
                    Email
                    <EmailToggle
                      shown={showEmails}
                      onToggle={() => setShowEmails((s) => !s)}
                    />
                  </span>
                </TableHead>
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
                    <EmailText email={row.email} shown={showEmails} />
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

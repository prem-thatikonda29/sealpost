"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getJob, type Job, type JobRow } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_BADGE: Record<string, string> = {
  sent: "bg-green-100 text-green-800 border-green-300",
  failed: "bg-red-100 text-red-800 border-red-300",
  invalid_domain: "bg-yellow-100 text-yellow-800 border-yellow-300",
  bounced: "bg-orange-100 text-orange-800 border-orange-300",
  skipped: "bg-slate-100 text-slate-600 border-slate-300",
  pending: "bg-muted text-muted-foreground border-border",
};

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
    getJob(jobId).then(setJob).finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!job) return <p className="text-sm text-destructive">Job not found</p>;

  const rows = job.rows ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/history" className="text-sm text-muted-foreground hover:underline">
            ← History
          </Link>
          <h1 className="text-xl font-semibold mt-1">
            {job.event_name ?? "One-off job"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(job.created_at).toLocaleString()}
            {job.dry_run && <span className="ml-2 italic">dry run</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(rows, job.id)}>
          Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sent", value: job.sent_count, color: "text-green-700" },
          { label: "Failed", value: job.failed_count, color: "text-red-700" },
          { label: "Invalid", value: job.invalid_count, color: "text-yellow-700" },
          { label: "Bounced", value: job.bounced_count, color: "text-orange-700" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 text-center">
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rows ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">#</th>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{row.row_index + 1}</td>
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.email}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs border rounded px-1.5 py-0.5 ${STATUS_BADGE[row.status] ?? STATUS_BADGE.pending}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {row.error_message ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

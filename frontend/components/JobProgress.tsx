"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RowState {
  index: number;
  name: string;
  email: string;
  status: string;
  error?: string;
}

interface DoneSummary {
  sent: number;
  failed: number;
  invalid: number;
  bounced: number;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  sent: { label: "Sent", class: "bg-green-100 text-green-800 border-green-300" },
  failed: { label: "Failed", class: "bg-red-100 text-red-800 border-red-300" },
  invalid_domain: { label: "Invalid domain", class: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  bounced: { label: "Bounced", class: "bg-orange-100 text-orange-800 border-orange-300" },
  skipped: { label: "Dry run", class: "bg-slate-100 text-slate-600 border-slate-300" },
  pending: { label: "Pending", class: "bg-muted text-muted-foreground border-border" },
};

function RowBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, class: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-block text-xs border rounded px-1.5 py-0.5 ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

export function JobProgress({ jobId, total }: { jobId: string; total: number }) {
  const [rows, setRows] = useState<Map<number, RowState>>(new Map());
  const [phase, setPhase] = useState<"sending" | "bounce_check" | "done">("sending");
  const [summary, setSummary] = useState<DoneSummary | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    const es = new EventSource(`${BASE}/api/jobs/${jobId}/progress`);
    esRef.current = es;

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "row") {
        setRows((prev) => {
          const next = new Map(prev);
          next.set(event.index, {
            index: event.index,
            name: event.name,
            email: event.email,
            status: event.status,
            error: event.error,
          });
          return next;
        });
      } else if (event.type === "phase" && event.phase === "bounce_check") {
        setPhase("bounce_check");
      } else if (event.type === "done") {
        setPhase("done");
        setSummary({
          sent: event.sent,
          failed: event.failed,
          invalid: event.invalid,
          bounced: event.bounced,
        });
        es.close();
      }
    };

    es.onerror = () => es.close();

    return () => {
      es.close();
    };
  }, [jobId]);

  const processed = Array.from(rows.values()).filter((r) => r.status !== "pending").length;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {phase === "bounce_check"
              ? "Checking for bounces…"
              : phase === "done"
              ? "Complete"
              : `Processing ${processed} / ${total}`}
          </span>
          <span>{pct}%</span>
        </div>
        <Progress value={phase === "done" ? 100 : pct} />
      </div>

      {/* Bounce check indicator */}
      {phase === "bounce_check" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <span className="inline-block w-2 h-2 bg-orange-400 rounded-full" />
          Polling Gmail inbox for bounce notifications (up to 30s)…
        </div>
      )}

      {/* Summary card on done */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Job Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-green-700">{summary.sent}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-red-700">{summary.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-yellow-700">{summary.invalid}</p>
                <p className="text-xs text-muted-foreground">Invalid</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-orange-700">{summary.bounced}</p>
                <p className="text-xs text-muted-foreground">Bounced</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row log */}
      {rows.size > 0 && (
        <div className="max-h-96 overflow-y-auto rounded border text-xs">
          <table className="w-full">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">#</th>
                <th className="text-left px-3 py-1.5 font-medium">Name</th>
                <th className="text-left px-3 py-1.5 font-medium">Email</th>
                <th className="text-left px-3 py-1.5 font-medium">Status</th>
                <th className="text-left px-3 py-1.5 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(rows.values())
                .sort((a, b) => a.index - b.index)
                .map((row) => (
                  <tr key={row.index} className="border-t">
                    <td className="px-3 py-1 text-muted-foreground">{row.index + 1}</td>
                    <td className="px-3 py-1">{row.name}</td>
                    <td className="px-3 py-1 font-mono">{row.email}</td>
                    <td className="px-3 py-1">
                      <RowBadge status={row.status} />
                    </td>
                    <td className="px-3 py-1 text-muted-foreground">{row.error ?? ""}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

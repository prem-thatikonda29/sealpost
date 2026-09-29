"use client";

import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";

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

  const statusLabel =
    phase === "bounce_check"
      ? "Checking for bounces…"
      : phase === "done"
        ? "Complete"
        : "Processing";

  const summaryCells = summary
    ? [
        { label: "Sent", value: summary.sent, tone: "text-sage-ink" },
        { label: "Failed", value: summary.failed, tone: "text-rose-ink" },
        { label: "Invalid", value: summary.invalid, tone: "text-amber-ink" },
        { label: "Bounced", value: summary.bounced, tone: "text-terra-ink" },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[13px]">{statusLabel}</span>
          <span className="font-mono text-[12px] text-muted-foreground tabular">
            {phase === "done" ? total : processed} / {total} · {phase === "done" ? 100 : pct}%
          </span>
        </div>
        <Progress value={phase === "done" ? 100 : pct} />
      </div>

      {/* Bounce polling */}
      {phase === "bounce_check" && (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="inline-block size-2 shrink-0 animate-pulse rounded-full bg-terra-ink" />
          Polling the Gmail inbox for bounce notifications — up to 30s.
        </p>
      )}

      {/* Outcome */}
      {summary && (
        <div className="space-y-3">
          <p className="label-mono">Outcome</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 hairline-grid">
            {summaryCells.map(({ label, value, tone }) => (
              <div key={label} className="px-4 py-4">
                <p className={`font-mono text-2xl leading-none tabular ${tone}`}>
                  {value}
                </p>
                <p className="label-mono mt-2">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row log */}
      {rows.size > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-muted">
                <tr className="border-b border-border">
                  <th className="label-mono w-10 px-3 py-2 text-left font-medium">
                    #
                  </th>
                  <th className="label-mono px-3 py-2 text-left font-medium">
                    Name
                  </th>
                  <th className="label-mono px-3 py-2 text-left font-medium">
                    Email
                  </th>
                  <th className="label-mono px-3 py-2 text-left font-medium">
                    Status
                  </th>
                  <th className="label-mono px-3 py-2 text-left font-medium">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from(rows.values())
                  .sort((a, b) => a.index - b.index)
                  .map((row) => (
                    <tr key={row.index} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 font-mono text-[12px] text-muted-foreground tabular">
                        {row.index + 1}
                      </td>
                      <td className="px-3 py-1.5 text-[13px]">{row.name}</td>
                      <td className="px-3 py-1.5 font-mono text-[12px]">
                        {row.email}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-1.5 text-[12px] text-muted-foreground">
                        {row.error ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmailText, EmailToggle } from "@/components/EmailToggle";
import { analyzeRows, type CleaningAnalysis, type CleaningRow } from "@/lib/api";
import type { CsvRow } from "@/components/CsvUploader";

interface Props {
  /** The rows as they came out of the file. */
  rows: CsvRow[];
  /** A generate-only run needs no addresses, so a blank one is not a problem. */
  requireEmail: boolean;
  onUse: (rows: CsvRow[]) => void;
  onCancel: () => void;
}

const has = (row: CleaningRow, code: string) =>
  row.issues.some((i) => i.code === code);

/** Tidy-ups are applied for you and reported once; only these need a decision. */
const problems = (row: CleaningRow) =>
  row.issues.filter((i) => i.severity !== "info");

/**
 * Look the list over before it is generated or sent.
 *
 * The server does the checking (one source of truth, and it is tested there).
 * Safe tidy-ups arrive already applied. What is left are decisions: remove a
 * repeat, take a spelling suggestion, fix a typo by hand. Every change re-runs
 * the check, so the list on screen is always the list that was analysed.
 */
export function CsvReview({ rows: initialRows, requireEmail: requireEmailProp, onUse, onCancel }: Props) {
  // The review works on its own fixed copies. If the parent's props change while
  // it is open, the user's edits must not be thrown away by a fresh first check.
  const [initial] = useState(initialRows);
  const [requireEmail] = useState(requireEmailProp);
  const [rows, setRows] = useState<CsvRow[]>(initial);
  // Only the latest request may update state; a late reply is dropped.
  const seq = useRef(0);
  const invalidate = useCallback(() => {
    seq.current++;
  }, []);
  const [analysis, setAnalysis] = useState<CleaningAnalysis | null>(null);
  const [tidied, setTidied] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True once a cell has been typed in. The analysis then describes the old
  // values, so bulk actions and "use" wait for a re-check.
  const [dirty, setDirty] = useState(false);
  // Addresses stay masked here too; they can only be edited once shown.
  const [showEmails, setShowEmails] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const run = useCallback(
    async (next: CsvRow[], first = false) => {
      const id = ++seq.current;
      setBusy(true);
      setError(null);
      try {
        const result = await analyzeRows(next, requireEmail);
        if (id !== seq.current) return;
        setAnalysis(result);
        setRows(result.rows.map((r) => ({ name: r.clean_name, email: r.clean_email })));
        if (first) setTidied(result.summary.tidied);
        setDirty(false);
      } catch (e) {
        if (id !== seq.current) return;
        const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data
          ?.detail;
        setError(typeof detail === "string" ? detail : "Could not check the list");
      } finally {
        if (id === seq.current) setBusy(false);
      }
    },
    [requireEmail]
  );

  useEffect(() => {
    // Deferred a tick so the initial check is not a synchronous setState in the effect.
    const t = setTimeout(() => run(initial, true), 0);
    return () => {
      clearTimeout(t);
      // Unmounting: ignore any reply still in flight.
      invalidate();
    };
  }, [initial, run, invalidate]);

  const found = analysis?.rows ?? [];
  const summary = analysis?.summary;
  const visible = found.filter((r) => showAll || problems(r).length > 0);
  const missingNames = found.filter((r) => has(r, "missing_name")).length;

  const removeWhere = (pred: (r: CleaningRow) => boolean) =>
    run(rows.filter((_, i) => !pred(found[i])));

  const takeSuggestions = () =>
    run(
      rows.map((row, i) => {
        const fix = found[i].issues.find((x) => x.code === "domain_typo")?.suggestion;
        return fix ? { ...row, email: fix.value } : row;
      })
    );

  const setCell = (i: number, field: keyof CsvRow, value: string) => {
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const canUse = !busy && !dirty && rows.length > 0 && missingNames === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="label-mono">Review list</p>
        {busy && (
          <span role="status" aria-live="polite" className="text-[12px] text-muted-foreground">
            Checking…
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-rose-ink">
          {error}
        </p>
      )}

      {summary && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="ok">{summary.clean} clean</Badge>
          {tidied > 0 && (
            <Badge variant="info">
              {tidied} tidied (spacing, capitals, address format)
            </Badge>
          )}
          {summary.errors > 0 && (
            <Badge variant="danger">{summary.errors} need fixing</Badge>
          )}
          {summary.duplicates > 0 && (
            <Badge variant="warn">
              {summary.duplicates} repeat{summary.duplicates > 1 ? "s" : ""}
            </Badge>
          )}
          {summary.typos > 0 && (
            <Badge variant="warn">
              {summary.typos} possible typo{summary.typos > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {summary && (
        <div className="flex flex-wrap items-center gap-2">
          {summary.duplicates > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || dirty}
              onClick={() => removeWhere((r) => has(r, "duplicate_email"))}
            >
              Remove {summary.duplicates} repeat{summary.duplicates > 1 ? "s" : ""}
            </Button>
          )}
          {summary.typos > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || dirty}
              onClick={takeSuggestions}
            >
              Fix {summary.typos} typo{summary.typos > 1 ? "s" : ""}
            </Button>
          )}
          {summary.errors > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || dirty}
              onClick={() => removeWhere((r) => r.issues.some((i) => i.severity === "error"))}
            >
              Remove {summary.errors} with errors
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !dirty}
            onClick={() => run(rows)}
          >
            Re-check
          </Button>
        </div>
      )}

      {summary && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-muted">
                <tr className="border-b border-border">
                  <th className="label-mono w-10 px-3 py-2 text-left font-medium">#</th>
                  <th className="label-mono px-3 py-2 text-left font-medium">Name</th>
                  <th className="label-mono px-3 py-2 text-left font-medium">
                    <span className="inline-flex items-center gap-2">
                      Email
                      <EmailToggle
                        shown={showEmails}
                        onToggle={() => setShowEmails((s) => !s)}
                      />
                    </span>
                  </th>
                  <th className="label-mono px-3 py-2 text-left font-medium">Issues</th>
                  <th className="w-20">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                      Nothing needs your attention.
                    </td>
                  </tr>
                )}
                {visible.map((r) => (
                  <tr key={r.index} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 font-mono text-[12px] text-muted-foreground tabular">
                      {r.index + 1}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        aria-label={`Name, row ${r.index + 1}`}
                        disabled={busy}
                        value={rows[r.index]?.name ?? ""}
                        onChange={(e) => setCell(r.index, "name", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[12px]">
                      {showEmails ? (
                        <Input
                          aria-label={`Email, row ${r.index + 1}`}
                          disabled={busy}
                          value={rows[r.index]?.email ?? ""}
                          onChange={(e) => setCell(r.index, "email", e.target.value)}
                        />
                      ) : (
                        <EmailText email={rows[r.index]?.email} shown={false} />
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {problems(r).map((i) => (
                          <Badge
                            key={i.code}
                            variant={i.severity === "error" ? "danger" : "warn"}
                          >
                            {i.message}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={`Remove row ${r.index + 1}`}
                        onClick={() => run(rows.filter((_, k) => k !== r.index))}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary && (
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
          <label htmlFor="csv-review-show-all" className="inline-flex items-center gap-2">
            <Checkbox
              id="csv-review-show-all"
              checked={showAll}
              onCheckedChange={(c) => setShowAll(c === true)}
            />
            Show all {found.length} rows
          </label>
          {!showEmails && <span>Show emails to edit them.</span>}
        </div>
      )}

      {missingNames > 0 && (
        <p className="text-[12px] text-rose-ink">
          {missingNames} row{missingNames > 1 ? "s have" : " has"} no name. A
          certificate needs one; add it or remove the row.
        </p>
      )}
      {dirty && (
        <p className="text-[12px] text-muted-foreground">
          You have edited rows. Re-check before using the list.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!canUse} onClick={() => onUse(rows)}>
          Use cleaned list — {rows.length} rows
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Back
        </Button>
        {!analysis && !busy && error && (
          <Button type="button" size="sm" onClick={() => run(initial, true)}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

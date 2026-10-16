"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailText, EmailToggle } from "@/components/EmailToggle";
import { CsvReview } from "@/components/CsvReview";
import { validateEmails, type EmailValidation } from "@/lib/api";
import { peopleCsvFile } from "@/lib/csv";

export interface CsvRow {
  name: string;
  email: string;
}

/**
 * Which columns the rows came from.
 *
 * These have to reach the job, not just this component. The backend re-parses
 * the uploaded file itself, so a UI that maps "Full Name" while the job is told
 * to read a column called "name" previews correctly and then renders blank
 * certificates.
 */
export interface CsvMapping {
  nameCol: string;
  /** Empty when the file has no address column — a generate-only run needs none. */
  emailCol: string;
}

/* The email column is optional, so the select needs a way to say "none" that a
   real header can't collide with. */
const NO_EMAIL = "__none__";

/** Columns whose values are joined to make the one name on the certificate. */
const nameParts = (nameCol: string) =>
  nameCol.split(",").map((c) => c.trim()).filter(Boolean);

/** The name a row contributes, matching what the backend will produce. */
export function rowName(row: Record<string, string>, nameCol: string): string {
  return nameParts(nameCol)
    .map((c) => (row[c] ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * "First Name" + "Last Name" as one selectable option.
 *
 * A certificate carries a single name, so a file that splits it across two
 * columns needs both. Choosing either one alone silently halves every name —
 * "Ada" where "Ada Lovelace" was meant — and no amount of picking a different
 * single column fixes it, which is why this is an option rather than a warning.
 */
function splitNameOption(cols: string[]): string {
  const first = cols.find((c) => /first\s*name/i.test(c));
  const last = cols.find((c) => /last\s*name|surname|family\s*name/i.test(c));
  return first && last && first !== last ? `${first},${last}` : "";
}

interface Props {
  onReady: (rows: CsvRow[], file: File, mapping: CsvMapping) => void;
  /**
   * The list handed over through onReady no longer matches what this uploader
   * shows (a column was changed, or a new file was picked). The parent should
   * drop it, so a run can't start on a list the user can no longer see.
   */
  onCleared?: () => void;
}

export function CsvUploader({ onReady, onCleared }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [nameCol, setNameCol] = useState("");
  const [emailCol, setEmailCol] = useState("");
  const [validation, setValidation] = useState<Record<string, EmailValidation>>({});
  const [validating, setValidating] = useState(false);
  // Addresses are personal data and this table is often on a shared screen, so
  // they stay hidden until the user asks. Reset on each upload.
  const [showEmails, setShowEmails] = useState(false);
  // Non-null while the review step is open: the rows it was opened with.
  const [reviewRows, setReviewRows] = useState<CsvRow[] | null>(null);
  // How many rows the user chose to keep after cleaning, shown once they have.
  const [cleanedRows, setCleanedRows] = useState<CsvRow[] | null>(null);
  const cleanedCount = cleanedRows ? cleanedRows.length : null;

  const changeNameCol = (v: string) => {
    setNameCol(v);
    setCleanedRows(null);
    setReviewRows(null);
    onCleared?.();
  };
  const changeEmailCol = (v: string) => {
    setEmailCol(v);
    setCleanedRows(null);
    setReviewRows(null);
    onCleared?.();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setValidation({});
    setShowEmails(false);
    setReviewRows(null);
    setCleanedRows(null);
    onCleared?.();

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? [];
        setHeaders(cols);
        setRawRows(result.data);

        // Auto-detect the columns (case-insensitive). Both stay empty rather
        // than guessing if nothing matches.
        //
        // A split name wins over the generic match: "First Name, Last Name"
        // contains "name" and would otherwise select the first column alone.
        const ec =
          cols.find(
            (c) => c.toLowerCase().includes("email") || c.toLowerCase().includes("e-mail")
          ) ?? "";
        const nc =
          splitNameOption(cols) ||
          cols.find((c) => c.toLowerCase().includes("name")) ||
          // A single column that isn't the address is the name. A one-column
          // file is the simplest case there is, and "Participant" or "Recipient"
          // contains no hint to match on — leaving it blank would mean the
          // easiest possible CSV needs a manual pick.
          (cols.length === 1 && cols[0] !== ec ? cols[0] : "") ||
          "";
        setNameCol(nc);
        setEmailCol(ec);
      },
    });
  };

  const handleValidate = async () => {
    if (!emailCol) return;
    setValidating(true);
    const emails = rawRows.map((r) => r[emailCol] ?? "").filter(Boolean);
    try {
      const results = await validateEmails(emails);
      const map: Record<string, EmailValidation> = {};
      results.forEach((r) => (map[r.email.toLowerCase()] = r));
      setValidation(map);
    } finally {
      setValidating(false);
    }
  };

  const mappedRows = (): CsvRow[] =>
    rawRows
      .map((r) => ({
        name: rowName(r, nameCol),
        email: emailCol ? (r[emailCol]?.trim() ?? "") : "",
      }))
      .filter((r) => r.name || r.email);

  const handleConfirm = () => {
    // A name is the only thing a certificate needs. The address is what makes
    // it *sendable*, and that is the run's problem, not the file's.
    if (!file || !nameCol) return;
    const rows = mappedRows();
    onReady(rows, file, { nameCol, emailCol });
  };

  const handleCleaned = (rows: CsvRow[]) => {
    if (!file) return;
    setReviewRows(null);
    setCleanedRows(rows);
    onReady(rows, peopleCsvFile(rows, file.name.replace(/\.csv$/i, "") + "-cleaned.csv"), {
      nameCol: "name",
      emailCol: emailCol ? "email" : "",
    });
  };

  const invalidCount = Object.values(validation).filter((v) => !v.valid).length;
  const combinedName = splitNameOption(headers);

  return (
    <div className="space-y-4">
      <p className="label-mono">Participants CSV</p>

      {/* File picker */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {file ? "Change file" : "Choose CSV"}
        </Button>
        {file && (
          <span className="font-mono text-[12px] text-muted-foreground tabular">
            {file.name} · {rawRows.length} rows
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* Column mapping */}
      {headers.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="csv-name-col" className="label-mono block">
              Name column
            </label>
            <Select value={nameCol} onValueChange={(v) => changeNameCol(v ?? "")}>
              <SelectTrigger id="csv-name-col">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {combinedName && (
                  <SelectItem value={combinedName}>
                    {nameParts(combinedName).join(" + ")}
                  </SelectItem>
                )}
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="csv-email-col" className="label-mono block">
              Email column
            </label>
            <Select
              value={emailCol || NO_EMAIL}
              onValueChange={(v) => changeEmailCol(v === NO_EMAIL ? "" : (v ?? ""))}
            >
              <SelectTrigger id="csv-email-col">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EMAIL}>No email column</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Only needed to send. Without one you can still generate every
              certificate.
            </p>
          </div>
        </div>
      )}

      {/* Validation */}
      {emailCol && rawRows.length > 0 && cleanedCount === null && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={validating}
          >
            {validating ? "Checking…" : "Check email domains"}
          </Button>
          {invalidCount > 0 && (
            <Badge variant="warn">
              {invalidCount} invalid domain{invalidCount > 1 ? "s" : ""}
            </Badge>
          )}
          {Object.keys(validation).length > 0 && invalidCount === 0 && (
            <Badge variant="ok">All domains valid</Badge>
          )}
        </div>
      )}

      {/* Preview */}
      {rawRows.length > 0 && nameCol && (
        <>
          {cleanedCount === null && (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="max-h-52 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-muted">
                  <tr className="border-b border-border">
                    <th className="label-mono w-10 px-3 py-2 text-left font-medium">
                      #
                    </th>
                    <th className="label-mono px-3 py-2 text-left font-medium">
                      Name
                    </th>
                    {emailCol && (
                      <>
                        <th className="label-mono px-3 py-2 text-left font-medium">
                          <span className="inline-flex items-center gap-2">
                            Email
                            <EmailToggle
                              shown={showEmails}
                              onToggle={() => setShowEmails((s) => !s)}
                            />
                          </span>
                        </th>
                        <th className="label-mono px-3 py-2 text-left font-medium">
                          Domain
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 100).map((row, i) => {
                    const em = (row[emailCol] ?? "").trim().toLowerCase();
                    const v = validation[em];
                    return (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-1.5 font-mono text-[12px] text-muted-foreground tabular">
                          {i + 1}
                        </td>
                        <td className="px-3 py-1.5 text-[13px]">
                          {rowName(row, nameCol)}
                        </td>
                        {emailCol && (
                          <>
                            <td className="px-3 py-1.5 font-mono text-[12px]">
                              <EmailText email={row[emailCol]} shown={showEmails} />
                            </td>
                            <td className="px-3 py-1.5 text-[12px]">
                              {v ? (
                                v.valid ? (
                                  <span className="text-sage-ink">Valid</span>
                                ) : (
                                  <span className="text-amber-ink" title={v.reason}>
                                    {v.reason}
                                  </span>
                                )
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {cleanedCount === null && rawRows.length > 100 && (
            <p className="text-[12px] text-muted-foreground">
              Showing the first 100 of {rawRows.length} rows. All of them will be
              sent.
            </p>
          )}

          {cleanedRows !== null && !reviewRows && (
            <div className="space-y-2">
              <p className="text-[12px] text-muted-foreground">
                This is the list that will be used. It started as{" "}
                {mappedRows().length} rows; {mappedRows().length - cleanedRows.length}{" "}
                removed during review, and tidied names and addresses are shown as
                they will be sent.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="border-b border-border">
                        <th className="label-mono w-10 px-3 py-2 text-left font-medium">
                          #
                        </th>
                        <th className="label-mono px-3 py-2 text-left font-medium">
                          Name
                        </th>
                        {emailCol && (
                          <th className="label-mono px-3 py-2 text-left font-medium">
                            <span className="inline-flex items-center gap-2">
                              Email
                              <EmailToggle
                                shown={showEmails}
                                onToggle={() => setShowEmails((s) => !s)}
                              />
                            </span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {cleanedRows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-1.5 font-mono text-[12px] text-muted-foreground tabular">
                            {i + 1}
                          </td>
                          <td className="px-3 py-1.5 text-[13px]">{row.name}</td>
                          {emailCol && (
                            <td className="px-3 py-1.5 font-mono text-[12px]">
                              <EmailText email={row.email} shown={showEmails} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {cleanedRows.length > 100 && (
                <p className="text-[12px] text-muted-foreground">
                  Showing the first 100 of {cleanedRows.length} rows. All of them will
                  be sent.
                </p>
              )}
            </div>
          )}

          {reviewRows ? (
            <CsvReview
              rows={reviewRows}
              requireEmail={Boolean(emailCol)}
              onUse={handleCleaned}
              onCancel={() => setReviewRows(null)}
            />
          ) : cleanedCount !== null ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="ok">
                Using cleaned list — {cleanedCount} of {rawRows.length} rows
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                title="Re-opens the original list from the file, discarding earlier removals and edits"
                onClick={() => setReviewRows(mappedRows())}
              >
                Start over
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setCleanedRows(null);
                  handleConfirm();
                }}
              >
                Use original file
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!nameCol}
                onClick={() => setReviewRows(mappedRows())}
              >
                Review & clean — {mappedRows().length} rows
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!nameCol}
                onClick={() => {
                  setCleanedRows(null);
                  handleConfirm();
                }}
              >
                Use as is
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

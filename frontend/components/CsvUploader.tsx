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
import { validateEmails, type EmailValidation } from "@/lib/api";

export interface CsvRow {
  name: string;
  email: string;
}

interface Props {
  onReady: (rows: CsvRow[], file: File) => void;
}

export function CsvUploader({ onReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [nameCol, setNameCol] = useState("");
  const [emailCol, setEmailCol] = useState("");
  const [validation, setValidation] = useState<Record<string, EmailValidation>>({});
  const [validating, setValidating] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setValidation({});

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? [];
        setHeaders(cols);
        setRawRows(result.data);

        // Auto-detect name + email columns (case-insensitive)
        const nc = cols.find((c) => c.toLowerCase().includes("name")) ?? "";
        const ec =
          cols.find(
            (c) => c.toLowerCase().includes("email") || c.toLowerCase().includes("e-mail")
          ) ?? "";
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

  const handleConfirm = () => {
    if (!file || !nameCol || !emailCol) return;
    const rows: CsvRow[] = rawRows
      .map((r) => ({ name: r[nameCol]?.trim() ?? "", email: r[emailCol]?.trim() ?? "" }))
      .filter((r) => r.name || r.email);
    onReady(rows, file);
  };

  const invalidCount = Object.values(validation).filter((v) => !v.valid).length;

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
            <Select value={nameCol} onValueChange={(v) => setNameCol(v ?? "")}>
              <SelectTrigger id="csv-name-col">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
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
            <Select value={emailCol} onValueChange={(v) => setEmailCol(v ?? "")}>
              <SelectTrigger id="csv-email-col">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Validation */}
      {emailCol && rawRows.length > 0 && (
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
      {rawRows.length > 0 && nameCol && emailCol && (
        <>
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
                    <th className="label-mono px-3 py-2 text-left font-medium">
                      Email
                    </th>
                    <th className="label-mono px-3 py-2 text-left font-medium">
                      Domain
                    </th>
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
                          {row[nameCol] ?? ""}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[12px]">
                          {row[emailCol] ?? ""}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {rawRows.length > 100 && (
            <p className="text-[12px] text-muted-foreground">
              Showing the first 100 of {rawRows.length} rows. All of them will be
              sent.
            </p>
          )}

          <Button
            type="button"
            size="sm"
            disabled={!nameCol || !emailCol}
            onClick={handleConfirm}
          >
            Use this CSV — {rawRows.length} rows
          </Button>
        </>
      )}
    </div>
  );
}

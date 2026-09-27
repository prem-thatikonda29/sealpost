"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Participants CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File picker */}
        <div className="flex gap-2 items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {file ? "Change File" : "Choose CSV"}
          </Button>
          {file && (
            <span className="text-sm text-muted-foreground">
              {file.name} — {rawRows.length} rows
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
              <Label>Name Column</Label>
              <Select value={nameCol} onValueChange={(v) => setNameCol(v ?? "")}>
                <SelectTrigger>
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
              <Label>Email Column</Label>
              <Select value={emailCol} onValueChange={(v) => setEmailCol(v ?? "")}>
                <SelectTrigger>
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
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={validating}
            >
              {validating ? "Checking emails…" : "Validate Emails"}
            </Button>
            {invalidCount > 0 && (
              <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50">
                ⚠ {invalidCount} invalid domain{invalidCount > 1 ? "s" : ""}
              </Badge>
            )}
            {Object.keys(validation).length > 0 && invalidCount === 0 && (
              <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50">
                ✓ All emails look valid
              </Badge>
            )}
          </div>
        )}

        {/* Preview table */}
        {rawRows.length > 0 && nameCol && emailCol && (
          <div className="max-h-52 overflow-y-auto rounded border text-xs">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">#</th>
                  <th className="text-left px-3 py-1.5 font-medium">Name</th>
                  <th className="text-left px-3 py-1.5 font-medium">Email</th>
                  <th className="text-left px-3 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rawRows.slice(0, 100).map((row, i) => {
                  const em = (row[emailCol] ?? "").trim().toLowerCase();
                  const v = validation[em];
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1">{row[nameCol] ?? ""}</td>
                      <td className="px-3 py-1 font-mono">{row[emailCol] ?? ""}</td>
                      <td className="px-3 py-1">
                        {v ? (
                          v.valid ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-yellow-600" title={v.reason}>⚠ {v.reason}</span>
                          )
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rawRows.length > 100 && (
              <p className="text-center text-muted-foreground py-2">
                …and {rawRows.length - 100} more rows
              </p>
            )}
          </div>
        )}

        {/* Confirm button */}
        {rawRows.length > 0 && (
          <Button
            type="button"
            size="sm"
            disabled={!nameCol || !emailCol}
            onClick={handleConfirm}
          >
            Use this CSV ({rawRows.length} rows)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

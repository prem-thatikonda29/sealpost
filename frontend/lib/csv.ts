import type { JobRow } from "@/lib/api";

/**
 * CSV serialisation for job rows.
 *
 * The export and the re-send payload have to agree, and only one of them
 * failing to escape would silently corrupt somebody's name. So the quoting
 * rule lives here once rather than inline at each call site.
 */
const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;

/**
 * The human-facing record: every row, every column, for a spreadsheet or for
 * keeping. Capitalised headers because it is meant to be read.
 */
export function rowsToRecordCsv(rows: JobRow[]): string {
  const header = ["#", "Name", "Email", "Status", "Error"];
  const lines = rows.map((r) => [
    r.row_index + 1,
    quote(r.name ?? ""),
    r.email ?? "",
    r.status,
    quote(r.error_message ?? ""),
  ]);
  return [header, ...lines].map((line) => line.join(",")).join("\n");
}

/**
 * The machine-facing payload: just the two columns a re-send reads. Uploading
 * this on the Run page works because both ends match column names
 * case-insensitively.
 */
export function rowsToUploadCsv(rows: JobRow[]): string {
  const lines = rows.map((r) => [quote(r.name ?? ""), r.email ?? ""]);
  return [["name", "email"], ...lines].map((line) => line.join(",")).join("\n");
}

export function csvFile(rows: JobRow[], filename: string): File {
  return new File([rowsToUploadCsv(rows)], filename, { type: "text/csv" });
}

/** Save a CSV, returning the object URL it used so the caller can revoke it. */
export function downloadCsv(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

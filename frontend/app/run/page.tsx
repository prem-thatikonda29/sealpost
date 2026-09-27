"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getEvents, createJob, type Event } from "@/lib/api";
import { CsvUploader, type CsvRow } from "@/components/CsvUploader";
import { JobProgress } from "@/components/JobProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function RunPageInner() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("event");

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(preselect ?? "");
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [batchSize, setBatchSize] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents().then(setEvents);
  }, []);

  const handleCsvReady = (rows: CsvRow[], file: File) => {
    setCsvRows(rows);
    setCsvFile(file);
  };

  const handleStart = async () => {
    if (!selectedEventId || !csvFile) return;
    setStarting(true);
    setError(null);
    try {
      const config = {
        event_id: selectedEventId,
        dry_run: dryRun,
        batch_size: batchSize,
        name_col: "name",
        email_col: "email",
      };
      const { job_id } = await createJob(config, csvFile);
      setJobId(job_id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to start job");
    } finally {
      setStarting(false);
    }
  };

  const canStart = !!selectedEventId && !!csvFile && !jobId;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Run</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate and send certificates
        </p>
      </div>

      {!jobId ? (
        <>
          {/* Event selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Event</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedEventId} onValueChange={(v) => setSelectedEventId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a saved event…" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* CSV upload */}
          <CsvUploader onReady={handleCsvReady} />

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dryRun"
                  checked={dryRun}
                  onCheckedChange={(v) => setDryRun(!!v)}
                />
                <Label htmlFor="dryRun">
                  Dry run — generate certificates but don&apos;t send emails
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batchSize">
                  Batch size{" "}
                  <span className="text-muted-foreground font-normal">(0 = all rows)</span>
                </Label>
                <Input
                  id="batchSize"
                  type="number"
                  min={0}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-32"
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleStart}
            disabled={!canStart || starting}
            className="w-full"
          >
            {starting ? "Starting…" : "Start Job"}
          </Button>
        </>
      ) : (
        <JobProgress jobId={jobId} total={csvRows?.length ?? 0} />
      )}
    </div>
  );
}

export default function RunPage() {
  return (
    <Suspense>
      <RunPageInner />
    </Suspense>
  );
}

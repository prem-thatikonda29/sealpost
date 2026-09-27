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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TierJob {
  jobId: string;
  eventName: string;
  total: number;
}

interface TierSetup {
  event: Event;
  checked: boolean;
  csvFile: File | null;
  csvRows: CsvRow[] | null;
  // Email content for this run — editable before starting
  emailSubject: string;
  emailBody: string;
}

function RunPageInner() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("event");

  const [tiers, setTiers] = useState<TierSetup[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [batchSize, setBatchSize] = useState(0);
  const [runningJobs, setRunningJobs] = useState<TierJob[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents().then((evs) => {
      setTiers(
        evs.map((ev) => ({
          event: ev,
          checked: preselect ? ev.id === preselect : false,
          csvFile: null,
          csvRows: null,
          emailSubject: "",
          emailBody: "Hi {name},\n\nPlease find your certificate attached.\n\nBest regards",
        }))
      );
    });
  }, [preselect]);

  const toggleTier = (id: string) =>
    setTiers((prev) =>
      prev.map((t) => (t.event.id === id ? { ...t, checked: !t.checked } : t))
    );

  const setCsv = (id: string, rows: CsvRow[], file: File) =>
    setTiers((prev) =>
      prev.map((t) =>
        t.event.id === id ? { ...t, csvFile: file, csvRows: rows } : t
      )
    );

  const setField = (id: string, field: "emailSubject" | "emailBody", value: string) =>
    setTiers((prev) =>
      prev.map((t) => (t.event.id === id ? { ...t, [field]: value } : t))
    );

  const selectedTiers = tiers.filter((t) => t.checked);
  const allReady =
    selectedTiers.length > 0 && selectedTiers.every((t) => t.csvFile !== null);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const jobs: TierJob[] = [];
    try {
      for (const tier of selectedTiers) {
        const config = {
          event_id: tier.event.id,
          email_subject: tier.emailSubject,
          email_body: tier.emailBody,
          dry_run: dryRun,
          batch_size: batchSize,
          name_col: "name",
          email_col: "email",
        };
        const { job_id } = await createJob(config, tier.csvFile!);
        jobs.push({
          jobId: job_id,
          eventName: tier.event.name,
          total: tier.csvRows?.length ?? 0,
        });
      }
      setRunningJobs(jobs);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to start job");
    } finally {
      setStarting(false);
    }
  };

  // ── Running view ────────────────────────────────────────────────────────────
  if (runningJobs) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-semibold">Running</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {runningJobs.length} tier{runningJobs.length > 1 ? "s" : ""} in progress
          </p>
        </div>
        {runningJobs.map((job) => (
          <Card key={job.jobId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{job.eventName}</CardTitle>
            </CardHeader>
            <CardContent>
              <JobProgress jobId={job.jobId} total={job.total} />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ── Setup view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Run</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Check the tiers you want to run, upload their CSVs, then start
        </p>
      </div>

      {tiers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No events found.{" "}
          <a href="/events/new" className="underline">
            Create an event first.
          </a>
        </p>
      )}

      {/* Tier checklist */}
      <div className="space-y-3">
        {tiers.map((tier) => (
          <Card
            key={tier.event.id}
            className={tier.checked ? "border-primary/50 bg-primary/5" : ""}
          >
            <CardContent className="pt-4 pb-4 space-y-4">
              {/* Row: checkbox + name + status badges */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`tier-${tier.event.id}`}
                  checked={tier.checked}
                  onCheckedChange={() => toggleTier(tier.event.id)}
                />
                <label
                  htmlFor={`tier-${tier.event.id}`}
                  className="font-medium text-sm cursor-pointer select-none"
                >
                  {tier.event.name}
                </label>
                <div className="ml-auto flex gap-1.5 flex-wrap justify-end">
                  {!tier.event.template_path && (
                    <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50 text-xs">
                      No template
                    </Badge>
                  )}
                  {!tier.event.text_position_x && (
                    <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50 text-xs">
                      No position
                    </Badge>
                  )}
                  {tier.csvRows && (
                    <Badge variant="outline" className="text-green-700 border-green-400 bg-green-50 text-xs">
                      {tier.csvRows.length} rows loaded
                    </Badge>
                  )}
                </div>
              </div>

              {/* Expanded section when checked */}
              {tier.checked && (
                <div className="pl-7 space-y-4">
                  {/* CSV upload */}
                  <CsvUploader
                    onReady={(rows, file) => setCsv(tier.event.id, rows, file)}
                  />

                  {/* Per-tier email settings */}
                  <div className="space-y-3 rounded-md border p-4 bg-background">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Email for this tier
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subject</Label>
                      <Input
                        value={tier.emailSubject}
                        onChange={(e) =>
                          setField(tier.event.id, "emailSubject", e.target.value)
                        }
                        placeholder="Your Certificate — Event Name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Body{" "}
                        <span className="text-muted-foreground font-normal">
                          — use {"{name}"} for recipient&apos;s first name
                        </span>
                      </Label>
                      <Textarea
                        value={tier.emailBody}
                        onChange={(e) =>
                          setField(tier.event.id, "emailBody", e.target.value)
                        }
                        rows={4}
                        placeholder={"Hi {name},\n\nPlease find your certificate attached."}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Shared run options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Options</CardTitle>
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleStart}
        disabled={!allReady || starting}
        className="w-full"
      >
        {starting
          ? "Starting…"
          : selectedTiers.length > 1
          ? `Start ${selectedTiers.length} tiers`
          : selectedTiers.length === 1
          ? `Start — ${selectedTiers[0].event.name}`
          : "Select at least one tier"}
      </Button>
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

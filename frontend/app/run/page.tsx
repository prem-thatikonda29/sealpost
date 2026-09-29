"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getEvents, createJob, type Event } from "@/lib/api";
import { CsvUploader, type CsvRow } from "@/components/CsvUploader";
import { JobProgress } from "@/components/JobProgress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";

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
  emailSubject: string;
  emailBody: string;
}

function RunPageInner() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("event");

  const [tiers, setTiers] = useState<TierSetup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [batchSize, setBatchSize] = useState(0);
  const [runningJobs, setRunningJobs] = useState<TierJob[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvents()
      .then((evs) => {
        setTiers(
          evs.map((ev) => ({
            event: ev,
            checked: preselect ? ev.id === preselect : false,
            csvFile: null,
            csvRows: null,
            emailSubject: "",
            emailBody:
              "Hi {name},\n\nPlease find your certificate attached.\n\nBest regards",
          }))
        );
      })
      .finally(() => setLoaded(true));
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

  const setField = (
    id: string,
    field: "emailSubject" | "emailBody",
    value: string
  ) =>
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
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title="Running"
          subtitle={`${runningJobs.length} tier${runningJobs.length > 1 ? "s" : ""} in progress`}
        />
        <div className="space-y-4">
          {runningJobs.map((job) => (
            <div
              key={job.jobId}
              className="overflow-hidden rounded-lg border border-border"
            >
              <div className="border-b border-border px-4 py-2.5">
                <h2 className="text-sm font-semibold">{job.eventName}</h2>
              </div>
              <div className="p-4">
                <JobProgress jobId={job.jobId} total={job.total} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Run" subtitle="Check the tiers you want to run" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── Setup view ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Run"
        subtitle="Check the tiers you want to run, upload their CSVs, then start"
      />

      {tiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hair-hover px-6 py-16 text-center">
          <p className="font-serif text-lg tracking-[-0.02em] text-foreground">
            No events to run
          </p>
          <p className="measure mx-auto mt-2 text-[13px] leading-relaxed text-muted-foreground">
            A run needs at least one event — that&apos;s what supplies the
            template and the name placement. Create one, then come back here to
            attach a participant CSV.
          </p>
          <a href="/events/new" className="mt-5 inline-block">
            <Button>Create an event</Button>
          </a>
        </div>
      ) : (
        <>
          {/* Tier checklist */}
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {tiers.map((tier) => {
              const blocked =
                !tier.event.template_path || !tier.event.text_position_x;
              return (
                <div key={tier.event.id}>
                  <div className="flex items-center gap-3 p-4">
                    <Checkbox
                      id={`tier-${tier.event.id}`}
                      checked={tier.checked}
                      onCheckedChange={() => toggleTier(tier.event.id)}
                    />
                    <label
                      htmlFor={`tier-${tier.event.id}`}
                      className="cursor-pointer text-sm font-semibold select-none"
                    >
                      {tier.event.name}
                    </label>

                    <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                      {!tier.event.template_path && (
                        <Badge variant="warn">No template</Badge>
                      )}
                      {!tier.event.text_position_x && (
                        <Badge variant="warn">No position</Badge>
                      )}
                      {tier.csvRows && (
                        <Badge variant="ok">
                          {tier.csvRows.length} rows
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Disclosure — state change, not decoration */}
                  {tier.checked && (
                    <div className="animate-in space-y-5 border-t border-border bg-surface-raised p-4 duration-200 ease-out-quart fade-in-0 slide-in-from-top-1">
                      {blocked && (
                        <p className="rounded-md bg-amber px-3 py-2 text-[13px] leading-relaxed text-amber-ink">
                          This event is missing a template or a name position.
                          It will fail when the job runs —{" "}
                          <a
                            href={`/events/${tier.event.id}`}
                            className="underline underline-offset-2"
                          >
                            fix it in the editor
                          </a>
                          .
                        </p>
                      )}

                      <CsvUploader
                        onReady={(rows, file) =>
                          setCsv(tier.event.id, rows, file)
                        }
                      />

                      <div className="space-y-4 border-t border-border pt-5">
                        <p className="label-mono">Email for this tier</p>

                        <div className="space-y-1.5">
                          <label
                            htmlFor={`subject-${tier.event.id}`}
                            className="label-mono block"
                          >
                            Subject
                          </label>
                          <Input
                            id={`subject-${tier.event.id}`}
                            value={tier.emailSubject}
                            onChange={(e) =>
                              setField(
                                tier.event.id,
                                "emailSubject",
                                e.target.value
                              )
                            }
                            placeholder="Your Certificate — Event Name"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor={`body-${tier.event.id}`}
                            className="label-mono block"
                          >
                            Body
                          </label>
                          <Textarea
                            id={`body-${tier.event.id}`}
                            value={tier.emailBody}
                            onChange={(e) =>
                              setField(tier.event.id, "emailBody", e.target.value)
                            }
                            rows={4}
                            placeholder={
                              "Hi {name},\n\nPlease find your certificate attached."
                            }
                          />
                          <p className="text-[12px] leading-relaxed text-muted-foreground">
                            {"{name}"} becomes the recipient&apos;s first name.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Shared run options */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-sm font-semibold">Run options</h2>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="dryRun"
                  checked={dryRun}
                  onCheckedChange={(v) => setDryRun(!!v)}
                />
                <label
                  htmlFor="dryRun"
                  className="cursor-pointer text-[13px] select-none"
                >
                  Dry run
                </label>
                <span className="text-[12px] text-muted-foreground">
                  — generate the certificates but send nothing
                </span>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="batchSize" className="label-mono block">
                  Batch size
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="batchSize"
                    type="number"
                    min={0}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-28 tabular"
                  />
                  <span className="text-[12px] text-muted-foreground">
                    0 sends everything in one batch
                  </span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-rose px-3 py-2 text-[13px] text-rose-ink"
            >
              {error}
            </p>
          )}

          <Button
            onClick={handleStart}
            disabled={!allReady || starting}
            size="lg"
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
        </>
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

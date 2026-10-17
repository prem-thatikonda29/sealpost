"use client";

import { useState } from "react";
import { createJob, type Job, type JobRow } from "@/lib/api";
import { csvFile, downloadCsv, rowsToRecordCsv } from "@/lib/csv";
import { EmailText } from "@/components/EmailToggle";
import { JobProgress } from "@/components/JobProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * A transient failure — an SMTP hiccup, a crashed render. Trying again is
 * exactly the right response.
 */
const RETRYABLE = ["failed"];

/**
 * The address itself is the problem: an invalid domain has no mail records at
 * all, and a bounce means it was accepted and then came back undeliverable.
 * Sending to either again fails the same way, every time — so they are kept out
 * of the retry button rather than padding it with guaranteed failures.
 */
const ADDRESS_PROBLEM = ["invalid_domain", "bounced"];

const describeAddress = (status: string) =>
  status === "bounced"
    ? "the mail was returned as undeliverable"
    : "the domain has no mail records";

export function ResendPanel({
  job,
  rows,
  showEmails = false,
}: {
  job: Job;
  rows: JobRow[];
  /** Follows the toggle on the page's row table, so one switch covers both. */
  showEmails?: boolean;
}) {
  const snapshot = job.event_snapshot;

  const retryable = rows.filter((r) => RETRYABLE.includes(r.status));
  const addressProblems = rows.filter((r) => ADDRESS_PROBLEM.includes(r.status));

  const [subject, setSubject] = useState<string>(snapshot?.email_subject ?? "");
  const [body, setBody] = useState<string>(snapshot?.email_body ?? "");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<{ id: string; total: number } | null>(
    null
  );

  // Once it is running there is nothing to configure, and the live view is the
  // honest replacement for the form — it shows the same generating/sending
  // states the Run page does.
  if (started) {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">Re-sending</h2>
        </div>
        <div className="p-4">
          <JobProgress jobId={started.id} total={started.total} />
        </div>
      </div>
    );
  }

  if (retryable.length === 0 && addressProblems.length === 0) return null;

  const start = async () => {
    if (!snapshot) return;
    setStarting(true);
    setError(null);
    try {
      // The certificate comes from the frozen snapshot, so a re-send produces
      // the same one everyone else received. The message is yours to rewrite —
      // an apology reads differently from the original invitation.
      const { email_subject, email_body, sealpost_footer, ...certificate } = snapshot;
      const { job_id } = await createJob(
        {
          event_config: certificate,
          email_subject: subject,
          email_body: body,
          sealpost_footer: !!sealpost_footer,
          name_col: "name",
          email_col: "email",
        },
        csvFile(retryable, `resend_${job.id.slice(0, 8)}.csv`)
      );
      setStarted({ id: job_id, total: retryable.length });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Could not start");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">Re-send</h2>
      </div>

      <div className="space-y-4 p-4">
        {!snapshot ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            This job did not record the settings it ran with, so it cannot be
            re-sent from here. Export the rows and run them again from the Run
            page.
          </p>
        ) : (
          <>
            {retryable.length > 0 && (
              <p className="text-[13px] leading-relaxed">
                <span className="font-medium">
                  {retryable.length}{" "}
                  {retryable.length === 1 ? "person" : "people"}
                </span>{" "}
                did not receive a certificate. Their failure was not about the
                address, so trying again can work.
              </p>
            )}

            {addressProblems.length > 0 && (
              <div className="space-y-2 rounded-md bg-amber px-3 py-2.5">
                <p className="text-[13px] leading-relaxed text-amber-ink">
                  <span className="font-medium">
                    {addressProblems.length}{" "}
                    {addressProblems.length === 1 ? "address" : "addresses"}
                  </span>{" "}
                  {addressProblems.length === 1 ? "is" : "are"} left out —
                  sending again would fail the same way:
                </p>
                <ul className="space-y-0.5 font-mono text-[12px] text-amber-ink">
                  {addressProblems.slice(0, 5).map((r) => (
                    <li key={r.id}>
                      <EmailText email={r.email} shown={showEmails} /> — {describeAddress(r.status)}
                    </li>
                  ))}
                  {addressProblems.length > 5 && (
                    <li>and {addressProblems.length - 5} more</li>
                  )}
                </ul>
                <p className="text-[12px] leading-relaxed text-amber-ink">
                  Correct them first. Export them, fix the addresses, then
                  upload the file on the Run page — a re-send checks every
                  address again before anything is sent.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      rowsToRecordCsv(addressProblems),
                      `job_${job.id.slice(0, 8)}_needs_fixing.csv`
                    )
                  }
                >
                  Export these {addressProblems.length}
                </Button>
              </div>
            )}

            {retryable.length > 0 && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="resend-subject" className="label-mono block">
                    Subject
                  </label>
                  <Input
                    id="resend-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-8 text-[13px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="resend-body" className="label-mono block">
                    Body
                  </label>
                  <Textarea
                    id="resend-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    className="text-[13px]"
                  />
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    Prefilled from the original message. Rewrite it if this one
                    needs to read differently.
                  </p>
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
                  type="button"
                  onClick={start}
                  disabled={starting || !subject.trim() || !body.trim()}
                >
                  {starting
                    ? "Starting…"
                    : `Re-send to ${retryable.length} ${
                        retryable.length === 1 ? "person" : "people"
                      }`}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

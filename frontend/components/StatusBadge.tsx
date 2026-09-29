import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

interface Meta {
  variant: BadgeVariant;
  label: string;
  /** Still in flight. Gets a spinner, because a label alone reads as a result. */
  active?: boolean;
}

/* The single status vocabulary. Every screen draws its status chips from here —
   sage is always success, amber always a warning, terra always a bounce, rose
   always a failure. A screen that hand-rolls its own green is a bug. */
const STATUS: Record<string, Meta> = {
  // job-level
  done: { variant: "ok", label: "Done" },
  running: { variant: "warn", label: "Running" },
  pending: { variant: "neutral", label: "Pending" },
  failed: { variant: "danger", label: "Failed" },
  // row-level
  sent: { variant: "ok", label: "Sent" },
  invalid_domain: { variant: "warn", label: "Invalid domain" },
  bounced: { variant: "info", label: "Bounced" },
  skipped: { variant: "neutral", label: "Dry run" },
  // row-level, in flight. These are streamed but never written to the row, so
  // they appear live and never in history — which is why they are listed here
  // anyway: the badge is still the one place a status becomes a colour.
  generating: { variant: "neutral", label: "Generating", active: true },
  sending: { variant: "neutral", label: "Sending", active: true },
};

/** Statuses that mean "this row is finished, one way or another". */
const TERMINAL = new Set([
  "sent",
  "failed",
  "invalid_domain",
  "bounced",
  "skipped",
]);

export const isTerminal = (status: string) => TERMINAL.has(status);

export function statusMeta(status: string): Meta {
  return STATUS[status] ?? { variant: "neutral", label: status };
}

export function StatusBadge({ status }: { status: string }) {
  const { variant, label, active } = statusMeta(status);
  return (
    <Badge variant={variant}>
      {active && (
        <Loader2Icon aria-hidden className="animate-spin motion-reduce:animate-none" />
      )}
      {label}
    </Badge>
  );
}

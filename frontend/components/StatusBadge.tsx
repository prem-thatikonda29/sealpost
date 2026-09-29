import { Badge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

interface Meta {
  variant: BadgeVariant;
  label: string;
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
};

export function statusMeta(status: string): Meta {
  return STATUS[status] ?? { variant: "neutral", label: status };
}

export function StatusBadge({ status }: { status: string }) {
  const { variant, label } = statusMeta(status);
  return <Badge variant={variant}>{label}</Badge>;
}

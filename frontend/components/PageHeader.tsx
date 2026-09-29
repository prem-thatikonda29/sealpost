import { cn } from "cn";

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/* The serif title voice. Page titles and the wordmark are the only places
   Newsreader appears — see the serif boundary in DESIGN.md. */
export function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-[26px] leading-tight tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

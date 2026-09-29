import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/* Status badges. The four accent variants map to the fixed status vocabulary in
   DESIGN.md — sage/success, amber/warning, terra/bounced, rose/danger. Screens
   pick a semantic variant; they never hand-roll a color. */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[3px] border border-transparent px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.08em] uppercase whitespace-nowrap transition-colors duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground border-border",
        outline: "border-border text-foreground [a]:hover:bg-surface-raised",
        /* The semantic four. */
        ok: "bg-sage text-sage-ink",
        warn: "bg-amber text-amber-ink",
        info: "bg-terra text-terra-ink",
        danger: "bg-rose text-rose-ink",
        neutral: "bg-muted text-muted-foreground",
        destructive: "bg-rose text-rose-ink",
        ghost: "text-muted-foreground",
        link: "text-terra-ink underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }

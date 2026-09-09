import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/20 text-primary border-primary/30 font-semibold",
        secondary:
          "border-border/60 bg-cinema-850/80 text-muted-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border/80",
        rating: "border-primary/40 bg-primary/10 text-primary font-bold shadow-sm",
        year: "border-border/50 bg-cinema-900/90 text-zinc-300",
        type: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-medium",
        votes: "border-border/40 bg-cinema-950/80 text-zinc-400 font-mono text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

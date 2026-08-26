import { cn } from "@/lib/cn";

/**
 * Card — the canonical Aura surface. Use instead of hand-rolling
 * `card-surface` strings.
 *
 * • default        → resting flat card with soft diffused depth
 * • interactive    → calm hover lift + press, for clickable cards
 * • glass          → translucent blurred surface, for overlays/floating panels
 */
export function Card({
  interactive = false,
  glass = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  glass?: boolean;
}) {
  return (
    <div
      className={cn(
        glass ? "glass rounded-md" : "card-surface",
        interactive && "card-interactive",
        className,
      )}
      {...props}
    />
  );
}

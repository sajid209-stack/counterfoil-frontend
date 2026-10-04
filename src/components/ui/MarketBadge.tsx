import { cn } from "@/lib/cn";
import { marketInitials } from "@/lib/marketplaces";
import type { MarketplaceId } from "@/lib/api/types";

/**
 * "This one was sold through a marketplace" — the marketplace's letters in a
 * small violet rounded rectangle.
 *
 * Colour is never the only carrier of that fact: the block's violet says it at
 * a glance, and this badge says it again with a shape and letters, so it
 * survives a grey screenshot and a colour-blind reader. It is decoration for a
 * sighted reader — the marketplace's NAME is in the block's accessible name —
 * so it is `aria-hidden`, which also exempts its white-on-violet text from the
 * 4.5:1 reading floor (it measures 5.7:1 anyway). Bold, because it is small.
 *
 * The fill is `market-solid`, pinned, so the white keeps its contrast in dark.
 *
 * `size` carries the type: OS holds a 12px floor and Go a 13px one, and `cn`
 * does not merge conflicting utilities, so the two cannot be a className.
 */
export function MarketBadge({
  id,
  size = "os",
  className,
}: {
  id: MarketplaceId;
  size?: "os" | "go";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xs bg-market-solid px-1 font-bold leading-none text-white",
        size === "go" ? "h-[1.125rem] min-w-[1.125rem] text-[0.8125rem]" : "h-4 min-w-4 text-[12px]",
        className,
      )}
    >
      {marketInitials(id)}
    </span>
  );
}

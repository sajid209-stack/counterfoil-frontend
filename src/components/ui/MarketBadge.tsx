import { cn } from "@/lib/cn";
import { marketInitials } from "@/lib/marketplaces";
import type { MarketplaceId } from "@/lib/api/types";

/**
 * "This one was sold through a marketplace" — the marketplace's letters in a
 * small info-blue rounded rectangle.
 *
 * Colour is never the only carrier of that fact: the block's blue says it at
 * a glance, and this badge says it again with a shape and letters, so it
 * survives a grey screenshot and a colour-blind reader. It is decoration for a
 * sighted reader — the marketplace's NAME is in the block's accessible name —
 * so it is `aria-hidden`. Bold, because it is small.
 *
 * The fill is `market-solid` (the info-blue family) and the letters are
 * `on-solid`, the text token for a solid fill, so the pair keeps its contrast
 * in light and in dark.
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
        "inline-flex shrink-0 items-center justify-center rounded-xs bg-market-solid px-1 font-bold leading-none text-on-solid",
        size === "go" ? "h-[1.125rem] min-w-[1.125rem] text-sm" : "h-4 min-w-4 text-xs",
        className,
      )}
    >
      {marketInitials(id)}
    </span>
  );
}

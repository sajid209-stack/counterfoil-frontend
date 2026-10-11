import { cn } from "@/lib/cn";

/**
 * Skeleton — a placeholder block for content that is on its way.
 *
 * `bg-subtle animate-pulse rounded-inner`, hidden from assistive tech (a
 * region that is loading should say so once, on the region, not once per
 * block). The global reduced-motion rule already stills the pulse.
 *
 * Size it with `w` / `h` (any CSS length: "96px", "60%", "2rem") or with
 * Tailwind classes in `className`. Both are optional.
 */
export function Skeleton({
  w,
  h,
  className,
  style,
}: {
  w?: string | number;
  h?: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse bg-subtle", !/rounded/.test(className ?? "") && "rounded-inner", className)}
      style={{ width: w, height: h, ...style }}
    />
  );
}

/** A paragraph of skeleton lines; the last one is shorter, like real prose. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-tight", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} h={12} w={i === lines - 1 && lines > 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

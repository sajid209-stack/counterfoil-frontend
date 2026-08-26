import { cn } from "@/lib/cn";

// The Counterfoil mark — the ticket/counterfoil glyph on a rounded tile.
// Self-contained and mode-aware: an ink tile with a paper glyph in light mode,
// inverted in dark so it always reads against the surface behind it.
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center bg-ink text-paper dark:bg-paper dark:text-ink",
        className,
      )}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
      aria-hidden
    >
      <svg viewBox="0 0 127 128" width={size * 0.62} height={size * 0.62} fill="none">
        <path
          d="M24 40.255C24 32.8308 31.3322 24 40.6395 24C46.5907 24 48.5328 24 64.7302 24C76.4302 24 88.2088 24 96.1145 24C98.6094 24 99.4348 27.3366 97.233 28.5092L84.6326 35.2194C82.9399 36.1208 82.9399 38.5459 84.6326 39.4473L101.73 48.5527C103.423 49.4541 103.423 51.8792 101.73 52.7806L84.6326 61.8858C82.9399 62.7872 82.9399 65.2128 84.6326 66.1142L101.73 75.2192C103.423 76.1206 103.423 78.5461 101.73 79.4475L84.694 88.5198C82.9894 89.4279 82.9982 91.8746 84.712 92.7657C88.4113 94.6882 93.9786 97.5948 98.5116 100.016C100.625 101.145 99.8824 104 97.4857 104C89.7869 104 77.8833 104 67.1261 104C52.6715 104 48.2997 104 41.5702 104C31.7976 104 24 95.4728 24 87.5845V40.255Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

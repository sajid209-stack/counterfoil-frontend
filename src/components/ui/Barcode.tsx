import { barcodeBars, barcodePattern, forBarcode } from "@/lib/barcode";

/**
 * A real, scannable Code 39 barcode as inline SVG — crisp at any size, prints
 * cleanly, no network. Shaped like `Qr` next door, and for the same reasons.
 *
 * The quiet zone is drawn rather than left to luck: a barcode with no white
 * margin either side is a barcode a scanner refuses, and the ten units here
 * are the symbology's own minimum.
 */
export function Barcode({
  value,
  height = 56,
  className,
  unit = 2,
}: {
  value: string;
  /** How tall the bars are. Width follows the code — a Code 39 is as wide as
   *  it needs to be, and squashing it is how it stops scanning. */
  height?: number;
  className?: string;
  /** Pixels per narrow bar. Two is the floor for a thermal printer. */
  unit?: number;
}) {
  const pattern = barcodePattern(value);
  if (!pattern) return null;
  const QUIET = 10;
  const bars = barcodeBars(pattern);
  const units = pattern.length + QUIET * 2;

  return (
    <svg
      width={units * unit}
      height={height}
      viewBox={`0 0 ${units} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Barcode ${forBarcode(value)}`}
      className={className}
    >
      <rect x={0} y={0} width={units} height={height} fill="#ffffff" />
      <g fill="#000000">
        {bars.map((b) => (
          <rect key={b.x} x={b.x + QUIET} y={0} width={b.width} height={height} />
        ))}
      </g>
    </svg>
  );
}

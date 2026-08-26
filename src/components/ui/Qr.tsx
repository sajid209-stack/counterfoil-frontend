import QRCode from "qrcode";

/** A real, scannable QR rendered as inline SVG (crisp at any size, prints
 *  cleanly, no network). Encodes `value` — for tickets, the ticket code. */
export function Qr({ value, size = 128, className }: { value: string; size?: number; className?: string }) {
  let count = 0;
  let data: Uint8Array = new Uint8Array();
  try {
    const qr = QRCode.create(value || " ", { errorCorrectionLevel: "M" });
    count = qr.modules.size;
    data = qr.modules.data as unknown as Uint8Array;
  } catch {
    count = 0;
  }

  const rects: React.ReactNode[] = [];
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (data[y * count + x]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${count || 1} ${count || 1}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code ${value}`}
      className={className}
    >
      <rect x={0} y={0} width={count || 1} height={count || 1} fill="#ffffff" />
      <g fill="#000000">{rects}</g>
    </svg>
  );
}

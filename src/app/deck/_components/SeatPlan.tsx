/**
 * An auditorium seen from the back: every seat on the plan in a state the
 * system knows — sold, admitted at the gate, held for a group, or still on
 * sale. The close of the deck, drawn as its promise rather than written.
 *
 * Seats are laid on concentric rows around a point far below the canvas, so
 * the rows curve gently toward the words beneath them, where the screen would
 * be. The states come from a fixed hash of each seat's position, so the plan
 * is the same drawing on every render and in the PDF.
 */

type State = "sold" | "admitted" | "held" | "open";

const CX = 800;
const CY = 2530;
const ROWS = 8;
const PITCH = 30;
const SEAT_W = 22;
const SEAT_H = 18;
const AISLE = [150, 184] as const;

const hash = (a: number, b: number) => {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function seats() {
  const out: { x: number; y: number; deg: number; state: State }[] = [];
  for (let row = 0; row < ROWS; row++) {
    const r = 2200 + row * 36;
    const half = 400 + row * 36;
    const step = PITCH / r;
    const span = Math.asin(half / r);
    for (let i = -Math.floor(span / step); i <= Math.floor(span / step); i++) {
      const t = i * step;
      const dx = r * Math.sin(t);
      const off = Math.abs(dx);
      if (off > AISLE[0] && off < AISLE[1]) continue;
      const h = hash(row + 1, i + 60);
      let state: State = "sold";
      if (dx < -AISLE[1] && dx > -340 && row >= 1 && row <= 3) state = "held";
      else if ((row >= 6 && h < 0.34) || (off > half - 70 && h < 0.5)) state = "open";
      else if (off < AISLE[0] && row <= 4 && h < 0.46) state = "admitted";
      out.push({ x: CX + dx, y: CY - r * Math.cos(t), deg: (t * 180) / Math.PI, state });
    }
  }
  return out;
}

const PLAN = seats();

export const SEAT_LEGEND: { state: State; label: string }[] = [
  { state: "sold", label: "Sold" },
  { state: "admitted", label: "Admitted" },
  { state: "held", label: "Held" },
  { state: "open", label: "On sale" },
];

export function SeatSwatch({ state, size = 16 }: { state: State; size?: number }) {
  return (
    <svg aria-hidden width={size} height={Math.round(size * 0.82)} viewBox="0 0 22 18">
      <Seat state={state} x={11} y={9} deg={0} />
    </svg>
  );
}

function Seat({ state, x, y, deg }: { state: State; x: number; y: number; deg: number }) {
  const common = { x: -SEAT_W / 2, y: -SEAT_H / 2, width: SEAT_W, height: SEAT_H, rx: 5, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(2)})` };
  if (state === "sold") return <rect {...common} fill="#f94a00" />;
  if (state === "admitted") return <rect {...common} fill="#f5f2eb" />;
  if (state === "held") return <rect {...common} fill="url(#deck-held)" stroke="#e0a54f" strokeWidth={1.5} />;
  return <rect {...common} fill="none" stroke="rgb(245 242 235 / 0.34)" strokeWidth={1.5} />;
}

export function SeatPlan({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} width={1600} height={480} viewBox="0 0 1600 480">
      <defs>
        <pattern id="deck-held" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="rgb(224 165 79 / 0.18)" />
          <rect width="2.4" height="6" fill="#e0a54f" />
        </pattern>
      </defs>
      {PLAN.map((seat, i) => (
        <Seat key={i} {...seat} />
      ))}
    </svg>
  );
}

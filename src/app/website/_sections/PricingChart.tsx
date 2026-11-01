"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "../_components/motion";
import { GROWTH, SHARE_HIGH, SHARE_LOW, TICKET_PRICE, evenAt, share, taka } from "./PricingData";

/* Monthly cost against tickets sold, at ৳500 a ticket. Drawn at measured 1:1
   width so labels are always real 12px+ text, never a scaled viewBox. The same
   math as the deck's CostSlide. */

const H = 340;
const PAD = { l: 50, r: 14, t: 14, b: 34 };
const X_MAX = 1200;
const Y_MAX = 72000;
const EMBER = "#f94a00";
const BLUE = "#7aa7ff";
const MUTED = "rgb(245 242 235 / 0.7)";

const lowCross = evenAt(SHARE_HIGH);
const highCross = evenAt(SHARE_LOW);
const at1000Low = share(1000, SHARE_LOW);
const at1000High = share(1000, SHARE_HIGH);

export function PricingChart() {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const seen = useInView(box, { threshold: 0.3 });
  const reduce = useReducedMotion();
  const drawn = reduce || seen;

  const pw = Math.max(0, w - PAD.l - PAD.r);
  const sx = (t: number) => PAD.l + (t / X_MAX) * pw;
  const sy = (c: number) => H - PAD.b - (c / Y_MAX) * (H - PAD.b - PAD.t);
  const xTicks = w < 420 ? [0, 600, 1200] : [0, 300, 600, 900, 1200];
  const flatY = sy(GROWTH.monthly);

  const summary = `Monthly cost against tickets sold, at ${taka(TICKET_PRICE)} a ticket. The Growth plan is flat at ${taka(GROWTH.monthly)} however many tickets are sold. A marketplace share of 6.5% to 12% of ticket revenue rises with every ticket and costs more than the plan from ${Math.round(lowCross)} to ${Math.round(highCross)} tickets a month. At 1,000 tickets that is ${taka(at1000Low)} to ${taka(at1000High)} against ${taka(GROWTH.monthly)}.`;

  const draw = (delay: number) => ({
    pathLength: 1,
    strokeDasharray: "1 1",
    strokeDashoffset: drawn ? 0 : 1,
    style: { transition: reduce ? "none" : `stroke-dashoffset 1500ms var(--w-ease-in-out) ${delay}ms` },
  });

  return (
    <figure className="w-panel-ink p-5 md:p-8">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <span className="w-eyebrow text-[var(--w-muted-ink)]">Monthly cost, at ৳{TICKET_PRICE} a ticket</span>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="h-[3px] w-6 rounded-full" style={{ background: EMBER }} />
            Counterfoil · Growth plan
          </li>
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="h-3 w-6 rounded-full opacity-50" style={{ background: BLUE }} />A marketplace share, 6.5–12%
          </li>
        </ul>
      </figcaption>

      <div ref={box} className="mt-6" style={{ height: H }}>
        {w > 0 && (
          <svg width={w} height={H} role="img" aria-label={summary} className="block">
            {[0, 20000, 40000, 60000].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={w - PAD.r} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? "rgb(245 242 235 / 0.3)" : "rgb(245 242 235 / 0.1)"} />
                <text x={PAD.l - 8} y={sy(v) + 4} textAnchor="end" fontSize={12} fill={MUTED}>
                  {v === 0 ? "৳0" : `৳${v / 1000}k`}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={sx(t)} y={H - PAD.b + 20} textAnchor={t === 0 ? "start" : t === X_MAX ? "end" : "middle"} fontSize={12} fill={MUTED}>
                {t.toLocaleString("en-US")}
              </text>
            ))}

            <polygon
              points={`${sx(0)},${sy(0)} ${sx(X_MAX)},${sy(share(X_MAX, SHARE_HIGH))} ${sx(X_MAX)},${sy(share(X_MAX, SHARE_LOW))}`}
              fill={BLUE}
              style={{ opacity: drawn ? 0.14 : 0, transition: reduce ? "none" : "opacity 1200ms var(--w-ease) 500ms" }}
            />
            <path d={`M${sx(0)} ${sy(0)}L${sx(X_MAX)} ${sy(share(X_MAX, SHARE_HIGH))}`} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" {...draw(150)} />
            <path d={`M${sx(0)} ${sy(0)}L${sx(X_MAX)} ${sy(share(X_MAX, SHARE_LOW))}`} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" {...draw(300)} />
            <path d={`M${sx(0)} ${flatY}L${sx(X_MAX)} ${flatY}`} fill="none" stroke={EMBER} strokeWidth={3} strokeLinecap="round" {...draw(0)} />

            <g style={{ opacity: drawn ? 1 : 0, transition: reduce ? "none" : "opacity 700ms var(--w-ease) 1300ms" }}>
              <line x1={sx(lowCross)} x2={sx(highCross)} y1={flatY} y2={flatY} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
              <text x={sx(highCross) + 10} y={flatY + 18} fontSize={12} fontWeight={600} fill="#fff">
                Cheaper from
              </text>
              <text x={sx(highCross) + 10} y={flatY + 32} fontSize={12} fontWeight={600} fill="#fff">
                {Math.round(lowCross)}–{Math.round(highCross)} tickets
              </text>
              {[share(1000, SHARE_HIGH), share(1000, SHARE_LOW), GROWTH.monthly].map((c, k) => (
                <circle key={c} cx={sx(1000)} cy={sy(c)} r={5} fill={k === 2 ? EMBER : BLUE} stroke="#141413" strokeWidth={2} />
              ))}
            </g>
          </svg>
        )}
      </div>
      <p className="mt-2 text-center text-[13px] text-[var(--w-muted-ink)]">Tickets sold a month</p>

      <dl className="mt-8 grid gap-4 border-t border-[var(--w-line-ink)] pt-6 sm:grid-cols-2">
        <div>
          <dt className="text-[14px] text-[var(--w-muted-ink)]">A marketplace share, at 1,000 tickets</dt>
          <dd className="mt-1 text-[24px] font-semibold tracking-[-0.02em] tabular-nums">
            {taka(at1000Low)}–{taka(at1000High)}
          </dd>
        </div>
        <div>
          <dt className="text-[14px] text-[var(--w-muted-ink)]">Counterfoil Growth, whatever you sell</dt>
          <dd className="mt-1 text-[24px] font-semibold tracking-[-0.02em] tabular-nums text-[var(--w-ember-soft)]">{taka(GROWTH.monthly)}</dd>
        </div>
      </dl>
      <p className="mt-5 text-[13px] leading-[1.5] text-[var(--w-muted-ink)]">
        The marketplace band is commission plus payment processing, at the range ticketing sites charge as a group; no platform is named. Plan fee only: SMS, email and waivers come with an allowance in every plan.
      </p>
    </figure>
  );
}

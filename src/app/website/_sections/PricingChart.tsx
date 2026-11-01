"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion, useTicker } from "../_components/motion";
import { GROWTH, SHARE_HIGH, SHARE_LOW, TICKET_PRICE, evenAt, share, taka } from "./PricingData";

/* Monthly cost against tickets sold, at ৳500 a ticket. Drawn at measured 1:1
   width so the labels are real 12px text, never a scaled viewBox. */

const H = 320;
const PAD = { l: 48, r: 14, t: 14, b: 32 };
const X_MAX = 1200;
const Y_MAX = 72000;
const INK = "#111110";
const GREY = "#a3a29e";
const STOPS = [200, 400, 600, 800, 1000, 1200];

const lowCross = evenAt(SHARE_HIGH);
const highCross = evenAt(SHARE_LOW);

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
  const live = useInView(box, { once: false, threshold: 0.3 });
  const reduce = useReducedMotion();
  const drawn = reduce || seen;
  const tick = useTicker(STOPS.length, 2200, live && seen && !reduce);
  const tickets = STOPS[reduce ? 2 : tick];

  const pw = Math.max(0, w - PAD.l - PAD.r);
  const sx = (t: number) => PAD.l + (t / X_MAX) * pw;
  const sy = (c: number) => H - PAD.b - (c / Y_MAX) * (H - PAD.b - PAD.t);
  const xTicks = w < 420 ? [0, 600, 1200] : [0, 300, 600, 900, 1200];
  const flatY = sy(GROWTH.monthly);
  const cx = sx(tickets);
  const flip = cx > w * 0.5;

  const summary = `Monthly cost against tickets sold, at ${taka(TICKET_PRICE)} a ticket. The Growth plan is flat at ${taka(GROWTH.monthly)} however many tickets are sold. A marketplace share of 6.5% to 12% of ticket revenue rises with every ticket, and costs more than the plan from ${Math.round(lowCross)} to ${Math.round(highCross)} tickets a month. At 1,000 tickets that is ${taka(share(1000, SHARE_LOW))} to ${taka(share(1000, SHARE_HIGH))} against ${taka(GROWTH.monthly)}.`;

  const draw = (delayMs: number) => ({
    pathLength: 1,
    strokeDasharray: "1 1",
    strokeDashoffset: drawn ? 0 : 1,
    style: { transition: reduce ? "none" : `stroke-dashoffset 1400ms var(--cf-ease-in-out) ${delayMs}ms` },
  });
  const fade = (delayMs: number) => ({
    opacity: drawn ? 1 : 0,
    transition: reduce ? "none" : `opacity 800ms var(--cf-ease) ${delayMs}ms`,
  });

  return (
    <figure className="cf-dots m-0 border-t border-[var(--cf-line)] p-4 md:p-8">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <span className="cf-label">Monthly cost, at ৳{TICKET_PRICE} a ticket</span>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[var(--cf-fg-2)]">
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-[2px] w-5 rounded-full" style={{ background: INK }} />
            Counterfoil Growth
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-5 rounded-[3px] border" style={{ background: "rgb(17 17 16 / 0.07)", borderColor: GREY }} />A marketplace share, 6.5–12%
          </li>
        </ul>
      </figcaption>

      <div ref={box} className="relative mt-5" style={{ height: H }}>
        {w > 0 && (
          <>
            <svg width={w} height={H} role="img" aria-label={summary} className="block">
              {[0, 20000, 40000, 60000].map((v) => (
                <g key={v}>
                  <line x1={PAD.l} x2={w - PAD.r} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? "#cfcdc8" : "#e4e2dd"} strokeDasharray={v === 0 ? undefined : "2 4"} />
                  <text x={PAD.l - 8} y={sy(v) + 4} textAnchor="end" fontSize={12} fill="#6b6a66">
                    {v === 0 ? "৳0" : `৳${v / 1000}k`}
                  </text>
                </g>
              ))}
              {xTicks.map((t) => (
                <text key={t} x={sx(t)} y={H - PAD.b + 20} textAnchor={t === 0 ? "start" : t === X_MAX ? "end" : "middle"} fontSize={12} fill="#6b6a66">
                  {t.toLocaleString("en-US")}
                </text>
              ))}

              <polygon
                points={`${sx(0)},${sy(0)} ${sx(X_MAX)},${sy(share(X_MAX, SHARE_HIGH))} ${sx(X_MAX)},${sy(share(X_MAX, SHARE_LOW))}`}
                fill="rgb(17 17 16 / 0.07)"
                style={fade(500)}
              />
              <path d={`M${sx(0)} ${sy(0)}L${sx(X_MAX)} ${sy(share(X_MAX, SHARE_HIGH))}`} fill="none" stroke={GREY} strokeWidth={1.25} {...draw(150)} />
              <path d={`M${sx(0)} ${sy(0)}L${sx(X_MAX)} ${sy(share(X_MAX, SHARE_LOW))}`} fill="none" stroke={GREY} strokeWidth={1.25} {...draw(300)} />
              <path d={`M${sx(0)} ${flatY}L${sx(X_MAX)} ${flatY}`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" {...draw(0)} />

              {/* Where the flat plan starts to win. */}
              <g style={fade(1200)}>
                <path d={`M${sx(lowCross)} ${flatY + 5}v7H${sx(highCross)}v-7`} fill="none" stroke={INK} strokeWidth={1.25} />
                <text x={sx(highCross) + 10} y={flatY + 30} fontSize={12} fontWeight={600} fill={INK}>
                  Cheaper from
                </text>
                <text x={sx(highCross) + 10} y={flatY + 44} fontSize={12} fontWeight={600} fill={INK}>
                  {Math.round(lowCross)}–{Math.round(highCross)} tickets
                </text>
              </g>

              {/* The sweeping guide. */}
              <g style={{ opacity: drawn ? 1 : 0, transform: `translateX(${cx}px)`, transition: reduce ? "none" : "transform 900ms var(--cf-ease-in-out), opacity 800ms var(--cf-ease) 1400ms" }}>
                <line x1={0} x2={0} y1={PAD.t} y2={H - PAD.b} stroke={INK} strokeOpacity={0.35} strokeDasharray="3 3" />
                {[share(tickets, SHARE_HIGH), share(tickets, SHARE_LOW), GROWTH.monthly].map((c, k) => (
                  <circle key={k} cx={0} cy={sy(c)} r={4} fill={k === 2 ? INK : "#fff"} stroke={k === 2 ? "#fff" : GREY} strokeWidth={1.5} />
                ))}
              </g>
            </svg>

            <div
              aria-hidden
              className="pointer-events-none absolute top-2 z-10 whitespace-nowrap rounded-lg border border-[var(--cf-line-2)] bg-white px-3 py-2 text-[12px] leading-[1.5] text-[var(--cf-fg-2)] shadow-[var(--cf-shadow)]"
              style={{
                left: cx,
                transform: `translateX(${flip ? "calc(-100% - 12px)" : "12px"})`,
                opacity: drawn ? 1 : 0,
                transition: reduce ? "none" : "left 900ms var(--cf-ease-in-out), opacity 800ms var(--cf-ease) 1400ms",
              }}
            >
              <span className="block font-semibold tabular-nums text-[var(--cf-fg)]">{tickets.toLocaleString("en-US")} tickets</span>
              <span className="block tabular-nums">
                Marketplace {taka(share(tickets, SHARE_LOW))}–{taka(share(tickets, SHARE_HIGH))}
              </span>
              <span className="block tabular-nums">Counterfoil {taka(GROWTH.monthly)}</span>
            </div>
          </>
        )}
      </div>
      <p className="mt-1 text-center text-[12px] text-[var(--cf-muted)]">Tickets sold a month</p>
      <p className="mt-4 text-[12px] leading-[1.5] text-[var(--cf-muted)]">
        The marketplace band is commission plus payment processing, at the range ticketing sites charge as a group; no platform is named. Plan fee only: SMS, email and waivers come with an allowance in every plan.
      </p>
    </figure>
  );
}

"use client";

import { formatClock } from "@/lib/format";
import { Check, MousePointer2, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/ui";
import s from "./brand-motion.module.css";

/* The four scenes of the brand panel's product story. Each is drawn at
   480 x 340 in the product's own tokens (the panel re-asserts the dark ones) and
   is decorative: the whole stage is aria-hidden, the caption beside it says the
   same thing in words. See brand-motion.module.css for the timing rules. */

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;
const v = (o: Vars) => o;

/* A deterministic QR-looking pattern, so server and client draw the same one. */
const QR = (() => {
  const N = 21;
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      const dx = x - fx, dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        return ring || core ? 1 : 0;
      }
      if (dx >= -1 && dx < 8 && dy >= -1 && dy < 8) return 0;
    }
    return -1;
  };
  let d = "";
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = finder(x, y);
    const on = f === -1 ? rnd() > 0.52 : f === 1;
    if (f === -1) rnd();
    if (on) d += `M${x} ${y}h1v1h-1z`;
  }
  return d;
})();

/* A smooth path through points (Catmull-Rom to cubic Bezier). */
function smooth(pts: [number, number][]) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
const W = 448;
const toPts = (ys: number[]): [number, number][] => ys.map((y, i) => [Math.round((W / (ys.length - 1)) * i), y]);
const THIS = smooth(toPts([104, 88, 96, 64, 70, 38, 22]));
const LAST = smooth(toPts([112, 100, 104, 88, 92, 74, 66]));

/* One digit column that rolls to its digit. */
function Odometer({ text, t0 }: { text: string; t0: number }) {
  let n = 0;
  return (
    <span className={s.odo} style={v({ "--t": `${t0}ms` })}>
      {[...text].map((ch, k) => {
        if (!/\d/.test(ch)) return <span key={k}>{ch}</span>;
        const i = n++;
        return (
          <span key={k} className={s.odoCol}>
            <span className={s.odoStrip} style={v({ "--d": ch, "--i": i })}>
              {"0123456789".split("").map((x) => <span key={x}>{x}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Pointer() {
  return (
    <span className={s.cursor} aria-hidden>
      <MousePointer2 size={22} className="fill-fg text-surface" strokeWidth={1.5} />
    </span>
  );
}

/* ── 1 · Sell ─────────────────────────────────────────────────────────── */
export function SceneSell() {
  const t = useTranslations("auth.shell.story.mini");
  const tiles = [
    { k: "adult", price: "৳800", at: 1100 },
    { k: "child", price: "৳400" },
    { k: "family", price: "৳2,000", at: 2100 },
    { k: "guide", price: "৳300", at: 2900 },
  ] as const;
  const rows = [
    { k: "adult", price: "৳800", at: 1100 },
    { k: "family", price: "৳2,000", at: 2100 },
    { k: "guide", price: "৳300", at: 2900 },
  ] as const;
  return (
    <>
      <div className={cn(s.till, s.card)}>
        <div className="text-sm font-medium text-muted">{t("tickets")}</div>
        <div className={s.tiles}>
          {tiles.map((x) => {
            const tapped = "at" in x;
            return (
              <div key={x.k} className={cn(s.tile, tapped && s.tapped)} style={v({ "--t": `${"at" in x ? x.at : 0}ms` })}>
                {tapped && <span className={s.sel} />}
                {tapped && <span className={s.ripple} />}
                {tapped && <span className={s.badge}><Check size={12} strokeWidth={3} /></span>}
                <span className={s.tileBody}>
                  <span className="text-base font-medium text-fg">{t(x.k)}</span>
                  <span className="text-sm text-muted">{x.price}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn(s.sale, s.card)}>
        <div className="text-sm font-medium text-muted">{t("sale")}</div>
        <div className={s.saleRows}>
          {rows.map((r) => (
            <div key={r.k} className={s.saleRow} style={v({ "--t": `${r.at}ms` })}>
              <span className="text-sm text-fg">{t(r.k)}</span>
              <span className="text-sm text-muted">{r.price}</span>
            </div>
          ))}
        </div>
        <div className={s.divider} />
        <div className={s.totalRow}>
          <span className="pb-1 text-sm text-muted">{t("total")}</span>
          <span className={cn(s.roll, "text-xl font-semibold text-fg")}>
            <span className={s.rollStrip}>
              <span>৳0</span><span>৳800</span><span>৳2,800</span><span>৳3,100</span>
            </span>
          </span>
        </div>
        <div className={cn(s.charge, s.chargePress, "text-base font-medium")}>
          {t("charge")}
          <span className={cn(s.paid, "text-base font-medium")}><Check size={16} strokeWidth={3} />{t("paid")}</span>
        </div>
      </div>
      <Pointer />
    </>
  );
}

/* ── 2 · Scan ─────────────────────────────────────────────────────────── */
function Corners() {
  return (
    <svg viewBox="0 0 112 112" aria-hidden>
      <path d="M4 26V12a8 8 0 0 1 8-8h14M86 4h14a8 8 0 0 1 8 8v14M108 86v14a8 8 0 0 1-8 8H86M26 108H12a8 8 0 0 1-8-8V86" />
    </svg>
  );
}
export function SceneScan() {
  const t = useTranslations("auth.shell.story.mini");
  return (
    <>
      <div className={s.ticketWrap}>
        <div className={s.ghost} aria-hidden />
        <div className={s.ticketEnter}>
          <div className={s.float} style={v({ "--fd": "-2s", height: "100%" })}>
            <div className={s.ticketShadow}>
              <div className={s.ticket}>
                <div className={s.ticketMain}>
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">{t("admission")}</span>
                    <LogoMark size={22} />
                  </div>
                  <div>
                    <div className="text-xl font-semibold tracking-title text-fg">{t("venue")}</div>
                    <div className="mt-inline text-sm text-muted">{t("meta")}</div>
                  </div>
                </div>
                <div className={s.stub}>
                  <div className={s.qr}>
                    <svg viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden><path d={QR} /></svg>
                    <span className={s.flash} />
                    <span className={cn(s.brackets, s.bracketsReady)}><Corners /></span>
                    <span className={cn(s.brackets, s.bracketsDone)}><Corners /></span>
                    <span className={s.beam} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className={s.ripRing} style={{ left: 348, top: 132 }} aria-hidden />
      <div className={s.pillRow}>
        <span className={cn(s.pill, s.pillReady, "text-sm font-medium text-fg")}>
          <span className={s.dotPulse} />{t("ready")}
        </span>
        <span className={cn(s.pill, s.pillOk, "text-base font-semibold")}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path className={s.check} pathLength={1} d="M3 8.5l3.2 3.2L13 4.8" /></svg>
          {t("letIn")}
        </span>
      </div>
    </>
  );
}

/* ── 3 · Know ─────────────────────────────────────────────────────────── */
export function SceneKnow() {
  const t = useTranslations("auth.shell.story.mini");
  const kpis = [
    { k: "sales", pre: "৳", val: "48,200", delta: "+12%", at: 200 },
    { k: "visitors", pre: "", val: "312", delta: "+8%", at: 320 },
    { k: "filled", pre: "", val: "86", post: "%", delta: "+5%", at: 440 },
  ] as const;
  return (
    <>
      <div className={s.kpis}>
        {kpis.map((x) => (
          <div key={x.k} className={cn(s.card, s.kpi)} style={v({ "--t": `${x.at}ms` })}>
            <div className="flex items-center justify-between gap-tight">
              <span className="text-sm text-muted">{t(x.k)}</span>
              <span className="rounded-full bg-success-wash px-tight text-xs font-medium text-success">{x.delta}</span>
            </div>
            <div className="text-2xl font-semibold tracking-figure text-fg">
              <span className="inline-flex">
                {x.pre}<Odometer text={x.val} t0={x.at} />{"post" in x ? x.post : null}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className={cn(s.card, s.chart)}>
        <div className="flex items-center">
          <span className="text-base font-semibold text-fg">{t("sales")}</span>
          <span className={cn(s.legend, "text-xs text-muted")}>
            <span><i className={s.legendDot} style={{ background: "var(--color-ember-solid)" }} />{t("week")}</span>
            <span><i className={s.legendDot} style={{ background: "var(--color-strong)" }} />{t("lastWeek")}</span>
          </span>
        </div>
        <div className={s.plot}>
          <svg viewBox="0 0 448 140" aria-hidden>
            <defs>
              <linearGradient id="authStageFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--color-ember-solid)", stopOpacity: 0.32 }} />
                <stop offset="1" style={{ stopColor: "var(--color-ember-solid)", stopOpacity: 0 }} />
              </linearGradient>
              <clipPath id="authStageReveal"><rect className={s.reveal} x="0" y="-10" width="448" height="160" /></clipPath>
            </defs>
            {[20, 60, 100, 140].map((y) => <line key={y} x1="0" x2="448" y1={y} y2={y} className={s.gridLine} />)}
            <path d={LAST} className={s.lastLine} />
            <g clipPath="url(#authStageReveal)">
              <path d={`${THIS}L448 140L0 140Z`} fill="url(#authStageFill)" />
              <path d={THIS} className={s.line} />
            </g>
            <circle cx="448" cy="22" r="7" className={s.endRing} />
            <circle cx="448" cy="22" r="4.5" className={s.endDot} />
          </svg>
          <span className={cn(s.tip, "text-xs font-medium")}>{t("today")} <b className="font-semibold">৳48,200</b></span>
        </div>
      </div>
    </>
  );
}

/* ── 4 · Fill ─────────────────────────────────────────────────────────── */
const SLOTS: [string, number][] = [
  ["09:00", 4], ["09:30", 4], ["10:00", 3], ["10:30", 4],
  ["11:00", 2], ["11:30", 3], ["12:00", 4], ["12:30", 1],
  ["13:00", 2], ["13:30", 0], ["14:00", 3], ["14:30", 1],
];
const TARGET = 5;
export function SceneFill() {
  const t = useTranslations("auth.shell.story.mini");
  return (
    <div className={cn(s.card, s.cal)}>
      <div className={s.calHead}>
        <span className="text-md font-semibold tracking-title text-fg">{t("tour")}</span>
        <span className="text-sm text-muted">{t("tourDate")}</span>
      </div>
      <div className={s.slots}>
        {SLOTS.map(([time, n], i) => {
          const isT = i === TARGET;
          const full = n === 4;
          const pips = (
            <span className={s.pips}>
              {[0, 1, 2, 3].map((p) => (
                <span key={p} className={cn(s.pip, isT && p === 3 && s.pipNew)}>
                  {(p < n || (isT && p === 3)) && <i />}
                </span>
              ))}
            </span>
          );
          return (
            <div key={time} className={cn(s.slot, (full || isT) && (isT ? s.slotTarget : s.slotFull))} style={v({ "--i": i })}>
              <span className={s.slotRow}>
                <span className="text-sm font-medium text-fg">{formatClock(time, { short: true })}</span>
                {isT && <Check size={14} strokeWidth={3} className="text-brand-foreground" aria-hidden />}
              </span>
              <span className={s.slotRow}>
                {pips}
                <span className={cn("text-xs", isT ? "font-medium text-brand-foreground" : "text-muted")}>
                  {full || isT ? t("full") : t("left", { n: 4 - n })}
                </span>
              </span>
              {isT && (
                <>
                  <span className={s.targetRing} />
                  <span className={cn(s.layer, s.openLayer)}>
                    <span className={s.slotRow}><span className="text-sm font-medium text-fg">{formatClock(time, { short: true })}</span></span>
                    <span className={s.slotRow}>
                      <span className={s.pips}>
                        {[0, 1, 2, 3].map((p) => <span key={p} className={s.pip}>{p < 3 && <i />}</span>)}
                      </span>
                      <span className="text-xs font-medium text-brand-foreground">{t("left", { n: 1 })}</span>
                    </span>
                  </span>
                  <span className={s.chipAnchor}>
                    <span className={cn(s.chip, "text-xs font-medium")}><Ticket size={13} aria-hidden />{t("newBooking")}</span>
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className={s.toastRow}>
        <span className={cn(s.toast, "text-sm font-medium")}><Check size={14} strokeWidth={3} aria-hidden />{t("booked")} · {formatClock("11:30")}</span>
      </div>
    </div>
  );
}

export const SCENES = [SceneSell, SceneScan, SceneKnow, SceneFill] as const;

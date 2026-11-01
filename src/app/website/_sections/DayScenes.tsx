import type { CSSProperties, ReactNode } from "react";
import { Check, X } from "lucide-react";
import { BrowserFrame, PhoneFrame } from "../_components/ui";
import bookings from "@/app/deck/_media/os-bookings.jpg";
import sheetShow from "@/app/deck/_media/go-sheet-show.jpg";
import scan from "@/app/deck/_media/go-scan.jpg";
import reports from "@/app/deck/_media/os-reports-dark.jpg";
import s from "./Day.module.css";

export type SceneId = "setup" | "sell" | "admit" | "reconcile";

const idx = (i: number) => ({ "--i": i }) as CSSProperties;

function Wrap({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className={`${s.scene} relative flex w-full justify-center pb-8`} data-on={on ? "" : undefined}>
      {children}
    </div>
  );
}

const SESSIONS = ["11:00", "11:45", "12:30", "13:15", "14:00", "14:45"];

function Setup({ on }: { on: boolean }) {
  return (
    <Wrap on={on}>
      <BrowserFrame src={bookings} alt="The Bookings list in Counterfoil OS: a yoga pack, a re-entry pass, a badminton court, a swim course, bowling lanes and more, each with its price" className="w-full max-w-[640px]" sizes="(min-width: 1024px) 640px, 100vw" />
      <div aria-hidden className={`${s.card} absolute bottom-0 right-2 w-[min(300px,86%)] rounded-[16px] bg-[var(--w-ink)] p-4 text-[var(--w-fg-ink)] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)] md:right-4`}>
        <p className="text-[15px] font-semibold tracking-[-0.02em]">Planetarium Show</p>
        <p className="w-mono mt-1 text-[12px] text-[var(--w-muted-ink)]">Every 45 min · 11:00–16:30 · 40 seats</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SESSIONS.map((t, i) => (
            <span key={t} style={idx(i)} className={`${s.chip} w-mono rounded-md bg-white/10 px-2 py-1 text-[12px]`}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

function Sell({ on }: { on: boolean }) {
  return (
    <Wrap on={on}>
      <PhoneFrame src={sheetShow} alt="Counterfoil Go: choosing a 45-minute Planetarium Show session, with seats left and the price on each" className="w-[min(250px,34vh)] min-w-[200px]" sizes="260px" />
      <div aria-hidden className={`${s.card} absolute bottom-6 right-0 w-[min(250px,78%)] rounded-[16px] bg-[var(--w-white)] p-4 shadow-[0_30px_60px_-20px_rgb(20_20_19/0.5),0_0_0_1px_var(--w-line)] md:-right-6`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-semibold">bKash</p>
          <p className="w-mono text-[14px] font-medium">৳1,035.00</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--w-line)]">
          <div className={`${s.progress} h-full rounded-full bg-[var(--w-ember)]`} />
        </div>
        <div className="relative mt-3 h-6 text-[13px]">
          <span className={`${s.pending} absolute inset-0 text-[var(--w-muted)]`}>Waiting for bKash…</span>
          <span className={`${s.paid} absolute inset-0 flex items-center gap-2 font-medium text-[#17663a]`}>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--w-success)] text-white">
              <Check aria-hidden size={12} strokeWidth={3} />
            </span>
            Paid ৳1,035.00
          </span>
        </div>
      </div>
    </Wrap>
  );
}

function Admit({ on }: { on: boolean }) {
  return (
    <Wrap on={on}>
      <PhoneFrame src={scan} alt="Counterfoil Go scan screen showing a ticket refused as already redeemed" className="w-[min(250px,34vh)] min-w-[200px]" sizes="260px" />
      <div aria-hidden className="absolute bottom-6 left-1/2 w-[min(270px,92%)] -translate-x-1/2 md:left-[58%]">
        <div className="relative">
          <div className={`${s.admit} rounded-[18px] bg-[var(--w-paper)] p-4 shadow-[0_30px_60px_-20px_rgb(20_20_19/0.55),0_0_0_1px_var(--w-line)]`}>
            <p className="w-mono text-[12px] text-[#17663a]">Scan accepted</p>
            <p className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.04em]">ADMIT 4 · Family</p>
            <div className="mt-3 flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`${s[`p${i}`]} grid h-7 w-7 place-items-center rounded-full bg-[var(--w-ink)] text-[var(--w-fg-ink)]`}>
                  <Check size={14} strokeWidth={2.6} />
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-[var(--w-muted)]">Group of 4 · 2 adults + 2 children</p>
          </div>
          <div
            className={`${s.refuse} absolute inset-0 rounded-[18px] p-4 text-white shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)]`}
            style={{ background: "repeating-linear-gradient(135deg, #b71c1c 0 10px, #9a1717 10px 20px)" }}
          >
            <p className="flex items-center gap-2 text-[22px] font-bold leading-none tracking-[-0.03em]">
              <X size={22} strokeWidth={3} />
              DO NOT ADMIT
            </p>
            <p className="mt-3 text-[14px] font-medium">Already admitted at 11:04 AM</p>
            <p className="w-mono mt-2 text-[12px] opacity-90">CF-2026-001000-01</p>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

const HOURS = [18, 30, 44, 62, 80, 70, 52, 66, 90, 74, 40, 22];

function Reconcile({ on }: { on: boolean }) {
  return (
    <Wrap on={on}>
      <BrowserFrame dark src={reports} alt="The Sales reports analytics view in Counterfoil OS: revenue over time, sales by hour, sales by day and the payment mix" className="w-full max-w-[640px]" sizes="(min-width: 1024px) 640px, 100vw" />
      <div aria-hidden className={`${s.card} absolute bottom-0 right-2 w-[min(290px,88%)] rounded-[16px] bg-[var(--w-paper)] p-4 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)] md:right-4`}>
        <p className="text-[15px] font-semibold tracking-[-0.02em]">Drawer counted</p>
        <p className={`${s.drawer} mt-1 flex items-center gap-2 text-[13px] text-[#17663a]`}>
          <Check size={14} strokeWidth={3} />
          Within ৳100 — closed square
        </p>
        <div className="mt-3 flex h-12 items-end gap-1">
          {HOURS.map((h, i) => (
            <span key={i} style={{ ...idx(i), height: `${h}%` }} className={`${s.bar} flex-1 rounded-[3px] bg-[var(--w-ember)]`} />
          ))}
        </div>
        <p className="w-mono mt-2 text-[12px] text-[var(--w-muted)]">Sales by hour</p>
      </div>
    </Wrap>
  );
}

export function Scene({ id, on }: { id: SceneId; on: boolean }) {
  if (id === "setup") return <Setup on={on} />;
  if (id === "sell") return <Sell on={on} />;
  if (id === "admit") return <Admit on={on} />;
  return <Reconcile on={on} />;
}

import { Check, Compass, HelpCircle, Hand, UserRound } from "lucide-react";
import { ProblemLoop } from "./ProblemLoop";
import styles from "./Problem.module.css";

const chip = "absolute left-1/2 top-1/2 -ml-[52px] -mt-[15px] flex h-[30px] w-[104px] items-center justify-center rounded-lg text-[12px] font-medium shadow-[0_6px_14px_-8px_rgb(20_20_19/0.5)]";

/** Two bookings slide into one 18:00 slot and flash red. */
export function ClashArt() {
  return (
    <ProblemLoop className="relative h-[92px] overflow-hidden rounded-xl bg-[var(--w-paper)]">
      <span className="w-mono absolute left-3 top-2.5 text-[12px] text-[var(--w-muted)]">18:00 · Field 2</span>
      <span className="absolute left-1/2 top-1/2 -ml-[60px] -mt-[22px] h-[44px] w-[120px] rounded-[10px] border border-dashed border-[var(--w-muted)]/50" />
      <span className={`${chip} ${styles.chipA} bg-[var(--w-ink)] text-[var(--w-fg-ink)]`}>Team A</span>
      <span className={`${chip} ${styles.chipB} bg-[var(--w-white)] text-[var(--w-fg)] ring-1 ring-[var(--w-line)]`}>Team B</span>
      <span className={`${styles.clash} absolute inset-0`}>
        <span className="absolute left-1/2 top-1/2 -ml-[68px] -mt-[28px] h-[56px] w-[136px] rounded-xl border-2 border-[#c4261d]" />
        <span className="absolute bottom-2 right-3 rounded-full bg-[#c4261d] px-2 py-0.5 text-[12px] font-medium text-white">Sold twice</span>
      </span>
    </ProblemLoop>
  );
}

/** A tour is booked; the guide slot stays empty. */
export function NoGuideArt() {
  return (
    <ProblemLoop className="relative flex h-[92px] items-center gap-3 overflow-hidden rounded-xl bg-[var(--w-paper)] px-4">
      <span className="flex h-[34px] items-center gap-2 rounded-lg bg-[var(--w-ink)] px-3 text-[12px] font-medium text-[var(--w-fg-ink)]">
        <Compass size={14} strokeWidth={1.7} /> Heritage Tour · 14:00
      </span>
      <span className={`${styles.tick} grid h-[22px] w-[22px] place-items-center rounded-full bg-[var(--w-success)] text-white`}>
        <Check size={13} strokeWidth={2.6} />
      </span>
      <span className={`${styles.emptyAvatar} ml-auto grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border-2 border-dashed border-[var(--w-muted)]/60 text-[var(--w-muted)]`}>
        <UserRound size={15} strokeWidth={1.6} />
      </span>
      <span className={`${styles.noGuide} absolute bottom-2 right-3 text-[12px] font-medium text-[#c4261d]`}>No guide free</span>
    </ProblemLoop>
  );
}

/** A paper stub passes from hand to hand and ends up unchecked. */
export function StubArt() {
  return (
    <ProblemLoop className="relative h-[92px] overflow-hidden rounded-xl bg-[var(--w-paper)] px-4">
      <div className={`${styles.track} relative mt-[22px] h-[36px]`}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--w-line)]" />
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center rounded-full bg-[var(--w-white)] text-[var(--w-muted)] ring-1 ring-[var(--w-line)]"
            style={{ left: i === 0 ? 0 : i === 1 ? "calc(50% - 15px)" : "calc(100% - 30px)" }}
          >
            {i === 2 ? <HelpCircle size={15} strokeWidth={1.6} /> : <Hand size={14} strokeWidth={1.6} />}
          </span>
        ))}
        <span className={`${styles.stub} absolute left-0 top-1/2 -mt-[10px] block h-[20px] w-[30px] rounded-[3px] border border-dashed border-[var(--w-ink)]/60 bg-[var(--w-ember-wash)]`} />
      </div>
      <span className={`${styles.unsure} absolute bottom-2 right-3 text-[12px] font-medium text-[#c4261d]`}>Can’t be checked</span>
    </ProblemLoop>
  );
}

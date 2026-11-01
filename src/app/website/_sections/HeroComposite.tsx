import { BrowserFrame, PhoneFrame } from "../_components/ui";
import dashDark from "@/app/deck/_media/os-dashboard-dark.jpg";
import phoneDark from "@/app/deck/_media/go-phone-sell-dark.jpg";
import styles from "./HeroComposite.module.css";

/** The seeded demo sale as a printed counterfoil: the body stays, the stub tears off and is re-seated. */
function LiveTicket() {
  return (
    <div className="w-float w-[210px] text-[var(--w-fg)] drop-shadow-[0_30px_40px_rgb(0_0_0/0.45)] sm:w-[250px]">
      <div className="rounded-t-[14px] bg-[var(--w-paper)] px-4 pb-3 pt-4">
        <p className="w-mono flex items-center justify-between text-[12px] uppercase tracking-[0.12em] text-[var(--w-muted)]">
          <span>Admit</span>
          <span className="rounded-full bg-[var(--w-ember)] px-2 py-0.5 text-[var(--w-ink)]">4</span>
        </p>
        <p className="mt-2 text-[17px] font-semibold leading-tight tracking-[-0.02em]">Planetarium Show</p>
        <p className="mt-1 text-[13px] text-[var(--w-muted)]">
          11:00 · Family · <span className="tabular-nums">৳1,400</span>
        </p>
      </div>
      <div className={styles.stub}>
        <div aria-hidden className="w-perf bg-[var(--w-paper)] text-[var(--w-muted)]" />
        <div className="flex items-center justify-between gap-3 rounded-b-[14px] bg-[var(--w-paper)] px-4 pb-3 pt-2.5">
          <span className="w-mono text-[12px] tracking-[0.04em] text-[var(--w-muted)]">CF-2026-001053</span>
          <span aria-hidden className="flex h-5 items-end gap-[2px]">
            {[10, 18, 8, 16, 12, 20, 9, 15].map((h, i) => (
              <span key={i} className="w-[2px] bg-[var(--w-fg)]" style={{ height: h }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

export function HeroComposite() {
  return (
    <div className="relative mx-auto w-full max-w-[1080px] pb-10 sm:pb-14">
      <div className={styles.stage}>
        <BrowserFrame
          dark
          priority
          src={dashDark}
          alt="Counterfoil OS dashboard in dark mode: revenue, capacity sold, arrivals and what needs attention"
          sizes="(min-width: 1200px) 1080px, 100vw"
        />
        <div className="absolute -bottom-6 right-2 w-[27%] min-w-[96px] sm:-bottom-10 sm:right-[-14px]">
          <PhoneFrame src={phoneDark} alt="Counterfoil Go on a phone in dark mode: the sell wall" sizes="(min-width: 1024px) 300px, 120px" />
        </div>
        <div aria-hidden className="absolute -bottom-8 left-3 hidden sm:block md:-left-6">
          <LiveTicket />
        </div>
      </div>
    </div>
  );
}

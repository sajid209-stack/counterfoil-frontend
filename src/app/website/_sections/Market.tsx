import { Banknote, CreditCard, type LucideIcon } from "lucide-react";
import { Section, delay } from "../_components/ui";

/* The six rails, from the deck's PAY list (deck/_slides/Close.tsx). */
const RAILS: { name: string; note: string; mark?: string; color?: string; icon?: LucideIcon }[] = [
  { name: "bKash", note: "By transaction ID", mark: "b", color: "#d1115f" },
  { name: "Bangla QR", note: "Any bank app", mark: "QR", color: "#0b7a4b" },
  { name: "SSLCOMMERZ", note: "Cards, online", mark: "SSL", color: "#2458a8" },
  { name: "Stripe", note: "Cards abroad", mark: "S", color: "#5a4fe6" },
  { name: "Card terminal", note: "Tap or insert", icon: CreditCard },
  { name: "Cash", note: "Counted at close", icon: Banknote },
];

export function Market() {
  return (
    <Section id="payments" tone="paper">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p data-reveal className="cf-eyebrow mb-4">Made for the market</p>
          <h2 data-reveal style={delay(60)} className="cf-h2">Built in Bangladesh. Ready anywhere.</h2>
          <p data-reveal style={delay(120)} className="cf-lead mt-5 max-w-[520px]">
            Bangla and English, bKash and Bangla QR, VAT and taka, with Stripe for cards abroad.
          </p>
          <p data-reveal style={delay(180)} className="cf-body mt-4 max-w-[520px]">
            Operators already run it in Bangladesh, Malaysia, the US and Canada.
          </p>
        </div>

        <ul data-reveal className="rounded-[20px] bg-white p-2 shadow-[var(--cf-shadow-frame)] sm:p-3">
          {RAILS.map(({ name, note, mark, color, icon: Icon }, i) => (
            <li key={name} className={`flex min-h-[64px] items-center gap-4 px-3 py-3 ${i > 0 ? "border-t border-[var(--cf-line)]" : ""}`}>
              {mark ? (
                <span aria-hidden className="grid h-10 min-w-10 shrink-0 place-items-center rounded-[12px] px-1.5 text-[13px] font-bold text-white" style={{ background: color }}>
                  {mark}
                </span>
              ) : (
                Icon && (
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--cf-paper)] text-[var(--cf-fg)]">
                    <Icon size={19} strokeWidth={1.7} />
                  </span>
                )
              )}
              <span className="min-w-0 flex-1 text-[16px] font-semibold text-[var(--cf-fg)]">{name}</span>
              <span className="text-right text-[14px] text-[var(--cf-muted)]">{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

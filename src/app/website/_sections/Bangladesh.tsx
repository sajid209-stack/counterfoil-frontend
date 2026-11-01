import { Banknote, CreditCard, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { Container, ChapterHead, Section } from "../_components/ui";
import { BangladeshVisual } from "./BangladeshVisual";

/* The local rails first, then the ones that travel (from the deck). */
const PAY: { name: string; note: string; mark?: string; color?: string; icon?: LucideIcon }[] = [
  { name: "bKash", note: "By transaction ID", mark: "b", color: "#d1115f" },
  { name: "Bangla QR", note: "Any bank app", mark: "QR", color: "#0b7a4b" },
  { name: "SSLCOMMERZ", note: "Cards, online", mark: "SSL", color: "#2458a8" },
  { name: "Stripe", note: "Cards abroad", mark: "S", color: "#5a4fe6" },
  { name: "Card terminal", note: "Tap or insert", icon: CreditCard },
  { name: "Cash", note: "Counted at close", icon: Banknote },
];

export function Bangladesh() {
  return (
    <Section id="bangladesh" tone="paper">
      <Container>
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div>
            <ChapterHead
              n="06"
              eyebrow="Made for the market"
              title="Built in Bangladesh. Ready anywhere."
              lead="Bangla and English, bKash and Bangla QR, VAT and taka — with Stripe for cards abroad."
            />
            <p data-reveal style={{ "--w-delay": "240ms" } as CSSProperties} className="w-eyebrow mt-12 text-[var(--w-muted)]">
              Takes payment by
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 min-[480px]:grid-cols-2">
              {PAY.map(({ name, note, mark, color, icon: Icon }, i) => (
                <li key={name} data-reveal style={{ "--w-delay": `${280 + i * 60}ms` } as CSSProperties} className="flex items-center gap-3.5">
                  {mark ? (
                    <span aria-hidden className="grid h-11 min-w-11 shrink-0 place-items-center rounded-xl px-1.5 text-[13px] font-bold text-white" style={{ background: color }}>
                      {mark}
                    </span>
                  ) : (
                    Icon && (
                      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--w-ink)] text-[var(--w-ember-soft)]">
                        <Icon size={19} strokeWidth={1.7} />
                      </span>
                    )
                  )}
                  <span className="min-w-0">
                    <span className="block text-[17px] font-semibold leading-tight">{name}</span>
                    <span className="mt-0.5 block text-[14px] text-[var(--w-muted)]">{note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p data-reveal className="mt-12 max-w-[440px] border-t border-[var(--w-line)] pt-6 text-[16px] leading-[1.5]">
              Operators already run it in Bangladesh, Malaysia, the US and Canada.
            </p>
          </div>
          <div data-reveal style={{ "--w-delay": "120ms" } as CSSProperties}>
            <BangladeshVisual />
          </div>
        </div>
      </Container>
    </Section>
  );
}

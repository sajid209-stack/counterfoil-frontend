import { Section, delay } from "../_components/ui";

const QA: { q: string; a: string }[] = [
  {
    q: "What is Counterfoil?",
    a: "A system for venues, tours and attractions that sell time: timed entry, tickets, bookings, seats and passes. The counter, the office and the scanner share one live record.",
  },
  {
    q: "Does it work at the counter and online?",
    a: "Yes. Staff sell and scan on a phone or tablet at the counter, and the office runs the calendar, orders and customers from a desktop. Online sales draw from the same capacity.",
  },
  {
    q: "Which payments does it take?",
    a: "bKash, Bangla QR, SSLCOMMERZ, Stripe for cards abroad, a card terminal and cash. Prices, VAT and change are worked in taka.",
  },
  {
    q: "Is it in Bangla?",
    a: "Yes. The till speaks Bangla and English, on every screen.",
  },
  {
    q: "Does it take a cut of my tickets?",
    a: "Not on the monthly plans: they cost the same whether you sell ten tickets or ten thousand. The Events plan is the exception, at 6% of ticket revenue with nothing monthly.",
  },
  {
    q: "Can two counters sell the same seat?",
    a: "No. Every place has one live capacity, so a place sold at one counter is gone at every other.",
  },
  {
    q: "How do I start?",
    a: "Start with Lite, which is free: one seat and one location. Add the rest when you are ready.",
  },
];

export function Faq() {
  return (
    <Section id="faq" tone="white">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.7fr] lg:gap-20">
        <h2 data-reveal className="cf-h2">Questions</h2>
        <div data-reveal style={delay(80)} className="border-b border-[var(--cf-line)]">
          {QA.map(({ q, a }) => (
            <details key={q} className="group border-t border-[var(--cf-line)]">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-6 py-3 text-[17px] font-medium text-[var(--cf-fg)] transition-colors duration-150 hover:text-[var(--cf-muted)] [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="relative h-4 w-4 shrink-0">
                  <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-current" />
                  <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-current transition-opacity duration-150 group-open:opacity-0" />
                </span>
              </summary>
              <p className="cf-body max-w-[640px] pb-6">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

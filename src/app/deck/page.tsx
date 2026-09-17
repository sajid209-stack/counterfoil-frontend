import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { deckStyles as s } from "./_components/Parts";
import { DeckScale } from "./_components/DeckScale";
import { CoverSlide, HowItWorksSlide, ProblemSlide, SystemSlide } from "./_slides/Open";
import { BookingTypesSlide, CalendarSlide, DashboardSlide, EventsSlide, ReportsSlide } from "./_slides/Os";
import { CounterCraftSlide, PosChooseSlide, PosFindSlide, PosGateSlide, PosPaySlide, PosTicketSlide } from "./_slides/Go";
import { BangladeshSlide, CloseSlide } from "./_slides/Close";
import { BetterSlide, CostSlide, IncludedSlide, MarketplaceSlide, PricingSlide } from "./_slides/Sales";
import logoOnPaper from "./_media/logo-counterfoil.png";

export const metadata = { title: "Counterfoil Deck" };

/** Built by `npm run deck:pdf` from this page's own slides. */
const PDF = "/counterfoil-deck.pdf";

/**
 * Counterfoil Deck — the case for Counterfoil, in twenty-two slides: the
 * problem, why it is better, the product, the till, the market, what a
 * marketplace costs and what Counterfoil costs.
 *
 * Not interactive: a deck to read top to bottom, or to download. Deliberately
 * outside the OS shell, the same way `/pos` and `/tills` are, so the sidebar's
 * ↗ tells the truth about leaving the admin app.
 *
 * Every slide is the same 1600 × 900 canvas scaled to the page, so every page
 * is the same size and the PDF is a picture of exactly these slides.
 *
 * What it shows is real: the screens are this product's own, captured from the
 * app, the figures are the project record's and the prices are the real
 * Bangladesh price list. A company deck that invents a statistic teaches its
 * reader to doubt the rest.
 */
export default function DeckPage() {
  return (
    <main className={s.stage}>
      <header data-deck-header className={s.header}>
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-4 py-2.5 sm:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <Image src={logoOnPaper} alt="Counterfoil" className="h-6 w-auto sm:h-7" priority sizes="160px" />
            <span aria-hidden className="hidden h-5 w-px bg-[#cfc9bd] sm:block" />
            <h1 className="sr-only truncate text-sm font-semibold tracking-tight text-[#22211f] sm:not-sr-only">Counterfoil Deck</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-mono text-[13px] text-[#57534c] transition-colors hover:text-[#aa3000]"
            >
              <ArrowLeft size={14} strokeWidth={1.5} aria-hidden /> Dashboard
            </Link>
            <a
              href={PDF}
              download="Counterfoil Deck.pdf"
              aria-label="Download the deck as a PDF"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#141413] px-4 text-[14px] font-medium text-[#f5f2eb] transition-colors hover:bg-[#2e2c29]"
            >
              <Download size={16} strokeWidth={1.8} aria-hidden />
              <span className="sm:hidden">PDF</span>
              <span className="hidden sm:inline">Download PDF</span>
            </a>
          </div>
        </div>
      </header>

      <div id="deck-column" className={s.column}>
        <DeckScale target="deck-column" />

        <CoverSlide n={1} />
        <ProblemSlide n={2} />
        <BetterSlide n={3} />
        <SystemSlide n={4} />
        <HowItWorksSlide n={5} />

        <DashboardSlide n={6} />
        <BookingTypesSlide n={7} />
        <CalendarSlide n={8} />
        <ReportsSlide n={9} />

        <PosFindSlide n={10} />
        <PosChooseSlide n={11} />
        <PosPaySlide n={12} />
        <PosTicketSlide n={13} />
        <PosGateSlide n={14} />
        <CounterCraftSlide n={15} />

        <BangladeshSlide n={16} />
        <EventsSlide n={17} />
        <MarketplaceSlide n={18} />

        <PricingSlide n={19} />
        <IncludedSlide n={20} />
        <CostSlide n={21} />
        <CloseSlide n={22} />
      </div>
    </main>
  );
}

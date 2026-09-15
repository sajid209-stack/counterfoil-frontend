import { TicketCard, type TicketCardData } from "@/components/ui";

/** An order's tickets, stacked on screen and one to a printed page, so each tears off and travels on its own. */
export function TicketSheets({ cards }: { cards: { id: string; data: TicketCardData }[] }) {
  return (
    <div className="flex flex-col items-center gap-8 print:block">
      {cards.map((card) => (
        <div key={card.id} className="w-full max-w-sm print:mx-auto print:not-last:break-after-page">
          <TicketCard data={card.data} />
        </div>
      ))}
    </div>
  );
}

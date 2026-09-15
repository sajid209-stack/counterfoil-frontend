"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Qr } from "@/components/ui";
import type { TicketCardData } from "@/components/ui/TicketCard";
import { OrderLinesDetail } from "@/components/OrderLinesDetail";
import { ReceiptFooter, ReceiptHeader } from "@/components/ReceiptParts";
import type { Order } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

type Header = ComponentProps<typeof ReceiptHeader>;

/** A tear across the strip: a dashed rule between two bites in the page's own colour, with an optional word in the middle. */
function Tear({ label }: { label?: string }) {
  const bite = "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--page)] print:bg-white";
  return (
    <div className="relative -mx-6 flex items-center gap-3 px-6 py-section">
      <span aria-hidden className={`${bite} left-0 -translate-x-1/2`} />
      <span aria-hidden className={`${bite} right-0 translate-x-1/2`} />
      <span aria-hidden className="h-0 flex-1 border-t border-dashed border-strong" />
      {label && (
        <>
          <span className="shrink-0 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{label}</span>
          <span aria-hidden className="h-0 flex-1 border-t border-dashed border-strong" />
        </>
      )}
    </div>
  );
}

/** One ticket on the strip: the QR the gate scans beside what it is for, stacked on the narrowest phones. */
function Stub({ card, referenceLabel }: { card: TicketCardData; referenceLabel: string }) {
  return (
    <div className="flex break-inside-avoid flex-col items-center gap-3 text-center @min-[19rem]:flex-row @min-[19rem]:items-start @min-[19rem]:gap-4 @min-[19rem]:text-left">
      <span className="shrink-0">
        <Qr value={card.code} size={96} />
      </span>
      <div className="w-full min-w-0 flex-1">
        {/* Centred with the rest of the stub when it stacks; name and "1 of 2" at opposite ends beside the QR. */}
        <div className="flex flex-wrap items-baseline justify-center gap-x-2 @min-[19rem]:flex-nowrap @min-[19rem]:justify-between">
          <p className="min-w-0 break-words text-[15px] font-semibold leading-snug text-fg">{card.productName}</p>
          {card.indexLabel && <span className="shrink-0 text-[12px] text-muted">{card.indexLabel}</span>}
        </div>
        {card.tierName && <p className="text-[13px] text-muted">{card.tierName}</p>}
        <dl className="mt-1.5 flex flex-col gap-0.5 text-[13px]">
          {card.fields.map((field) => (
            <div key={field.label} className="flex justify-center gap-1.5 @min-[19rem]:justify-start">
              <dt className="shrink-0 text-muted">{field.label}</dt>
              <dd className="min-w-0 break-words font-medium text-fg">{field.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 break-all font-mono text-[13px] text-fg">
          <span className="sr-only">{referenceLabel}: </span>
          {card.code}
        </p>
      </div>
    </div>
  );
}

/**
 * The ticket receipt: one strip of paper that is both the receipt and every
 * ticket the order issued.
 *
 * It reads the way receipts are read, top to bottom — who sold it, which sale
 * and when, what was bought, the totals, how it was paid — and then tears into
 * the tickets: a dashed rule that says how many, and one stub per ticket with
 * the QR the gate scans. The receipt half is the same header and line detail
 * the receipt page prints, so the two can never disagree about the money.
 *
 * `paper` pins the light colours, so it stays dark type on white in either
 * theme and prints as it appears. The page supplies `--page`, the colour the
 * notches are cut in.
 */
export function TicketReceipt({
  order,
  operator,
  place,
  tax,
  footer,
  cards,
}: {
  order: Order;
  operator: Header["operator"];
  place: Header["place"];
  tax: Header["tax"];
  footer?: ComponentProps<typeof ReceiptFooter>["message"];
  cards: { id: string; data: TicketCardData }[];
}) {
  const t = useTranslations("ticket");
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt));
  return (
    <article
      aria-label={t("printAllTitle")}
      className="paper @container relative mx-auto w-full max-w-[380px] overflow-hidden rounded-[18px] bg-white px-6 pb-6 pt-7 text-fg shadow-[0_1px_2px_rgba(20,20,19,0.05),0_18px_40px_-18px_rgba(20,20,19,0.22)] print:rounded-none print:border print:border-neutral-300 print:shadow-none"
    >
      <ReceiptHeader operator={operator} place={place} tax={tax}>
        {/* Two groups that each stay whole, so a narrow strip wraps between the reference and the date, never inside either. */}
        <p className="mt-tight flex flex-wrap justify-center gap-x-3 font-mono text-[12px] text-muted">
          <span className="whitespace-nowrap">{order.reference}</span>
          <span className="whitespace-nowrap">
            {formatDate(order.createdAt)} · {time}
          </span>
        </p>
      </ReceiptHeader>

      <OrderLinesDetail order={order} />

      {cards.length > 0 && (
        <>
          <Tear label={t("ticketsCount", { count: cards.length })} />
          {cards.map((card, i) => (
            <div key={card.id}>
              {i > 0 && <Tear />}
              <Stub card={card.data} referenceLabel={t("referenceLabel")} />
            </div>
          ))}
          <p className="mt-section text-center text-[13px] text-muted">{t("gateHint")}</p>
        </>
      )}

      <ReceiptFooter message={footer} />
    </article>
  );
}

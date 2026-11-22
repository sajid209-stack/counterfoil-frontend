"use client";

import { useTranslations } from "next-intl";
import { Qr } from "@/components/ui";
import type { TicketCardData } from "@/components/ui/TicketCard";
import { ReceiptBottom, ReceiptItems, ReceiptPayments, ReceiptRule, ReceiptTop, ReceiptTotals } from "@/components/ReceiptParts";
import { ReceiptPrintStyle } from "@/components/receipt/PrintStyle";
import { stripMetrics, type ReceiptData } from "@/components/receipt/types";
import { cn } from "@/lib/cn";

/** A tear across the strip: a dashed rule between two bites in the page's own colour, with an optional word in the middle. */
function Tear({ label, pad }: { label?: string; pad: number }) {
  const bite = "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--page)] print:bg-white";
  return (
    <div className="relative flex items-center gap-tight py-section" style={{ marginInline: `-${pad}mm`, paddingInline: `${pad}mm` }}>
      <span aria-hidden className={`${bite} left-0 -translate-x-1/2`} />
      <span aria-hidden className={`${bite} right-0 translate-x-1/2`} />
      <span aria-hidden className="h-0 flex-1 border-t border-dashed border-fg-secondary" />
      {label && (
        <>
          <span className="shrink-0 text-xs font-medium uppercase tracking-widest">{label}</span>
          <span aria-hidden className="h-0 flex-1 border-t border-dashed border-fg-secondary" />
        </>
      )}
    </div>
  );
}

/** One ticket on the strip: the QR the gate scans, then what it is for. The roll is narrow, so it stacks and centres. */
function Stub({ card, referenceLabel }: { card: TicketCardData; referenceLabel: string }) {
  return (
    <div className="flex break-inside-avoid flex-col items-center gap-tight text-center">
      {card.logo && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored data URL or a path; next/image adds nothing on paper
        <img data-ticket-logo src={card.logo} alt={card.business} className="h-8 w-auto max-w-full object-contain grayscale" />
      )}
      <Qr value={card.code} size={104} />
      <div className="w-full min-w-0">
        <div className="flex flex-wrap items-baseline justify-center gap-x-tight">
          <p className="min-w-0 break-words text-base font-semibold leading-snug">{card.productName}</p>
          {card.indexLabel && <span className="shrink-0 text-xs">{card.indexLabel}</span>}
        </div>
        {card.tierName && <p className="text-sm">{card.tierName}</p>}
        <dl className="mt-inline flex flex-col gap-0.5 text-sm">
          {card.fields.map((field) => (
            <div key={field.label} className="flex justify-center gap-inline">
              <dt className="shrink-0 text-muted">{field.label}</dt>
              <dd className="min-w-0 break-words font-medium">{field.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-inline break-all font-mono text-sm">
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
 * It reads the way receipts are read, top to bottom — logo and business, the
 * sale, what was bought, the totals, how it was paid — and then tears into the
 * tickets: a dashed rule that says how many, and one stub per ticket with the
 * QR the gate scans. The receipt half is the same top, items, totals and
 * payments the receipt page prints, so the two can never disagree about the
 * money. There is no lookup QR here: every stub already carries a code, and a
 * second one on the same strip is one more thing for the gate to scan wrongly.
 *
 * It is always a roll (A4 is a receipt-only layout). `paper` pins the light
 * colours, so it stays dark type on white in either theme; the page supplies
 * `--page`, the colour the notches are cut in.
 */
export function TicketReceipt({ data, cards }: { data: ReceiptData; cards: { id: string; data: TicketCardData }[] }) {
  const t = useTranslations("ticket");
  const roll: ReceiptData = { ...data, settings: { ...data.settings, paper: data.settings.paper === "58mm" ? "58mm" : "80mm", showLookupQr: false } };
  const { column, pad } = stripMetrics(roll.settings.paper);
  return (
    <>
      <ReceiptPrintStyle paper={roll.settings.paper} />
      <article
        aria-label={t("printAllTitle")}
        className={cn("paper rcpt-strip relative mx-auto overflow-hidden rounded-inner bg-white text-fg shadow-float", roll.settings.paper === "58mm" ? "text-xs" : "text-sm")}
        style={{ width: `${column + pad * 2}mm`, maxWidth: "100%", padding: `6mm ${pad}mm` }}
      >
        <ReceiptTop data={roll} />
        <ReceiptRule className="my-comfortable" />
        <ReceiptItems data={roll} />
        <ReceiptRule className="my-comfortable" />
        <ReceiptTotals data={roll} />
        <ReceiptRule className="my-comfortable" />
        <ReceiptPayments data={roll} />

        {cards.length > 0 && (
          <>
            <Tear label={t("ticketsCount", { count: cards.length })} pad={pad} />
            {cards.map((card, i) => (
              <div key={card.id}>
                {i > 0 && <Tear pad={pad} />}
                <Stub card={card.data} referenceLabel={t("referenceLabel")} />
              </div>
            ))}
            <p className="mt-section text-center text-sm">{t("gateHint")}</p>
          </>
        )}

        <ReceiptBottom data={roll} />
      </article>
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, Download } from "lucide-react";
import { Button, TicketCard } from "@/components/ui";
import { ticketCards, useTicketLabels } from "@/app/print/_lib/ticketCards";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import type { Order, Ticket } from "@/lib/api/types";
import { StorefrontChrome } from "../Chrome";

/** Add to calendar, as a Google template link — the same approach the event
 *  pages use and for the same reason: a downloaded .ics is blocked inside
 *  the preview's iframe, and this opens in the calendar most guests use. */
function calendarLink(title: string, date: string, startTime?: string, endTime?: string): string {
  const stamp = (d: string) => d.replace(/[-:]/g, "");
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const startMin = startTime ? toMin(startTime) : 9 * 60;
  const endMin = endTime ? toMin(endTime) : startMin + 120;
  const asTime = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const start = `${date}T${asTime(startMin)}:00`;
  const end = `${date}T${asTime(endMin)}:00`;
  const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${stamp(start)}/${stamp(end)}` });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/**
 * The confirmation: big success, a reference, every ticket with its QR, and
 * one way back in. The same screen in live and preview — only the data is
 * different, and preview says so rather than hiding it.
 */
export function ConfirmationScreen({ order, tickets, isPreview }: { order: Order; tickets: Ticket[]; isPreview: boolean }) {
  const flow = useStorefrontFlow();
  const router = useRouter();
  const t = useTranslations("storefront");
  const labels = useTicketLabels();
  const business = flow.operator?.name ?? flow.location.name;
  const cards = ticketCards(order, tickets, business, labels);
  const datedLines = order.lines.filter((l) => l.booking?.date && !l.parentLineId);

  return (
    <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")} preview={flow.mode === "preview"}>
      <div className="flex flex-col items-center gap-tight pb-section text-center">
        <CheckCircle2 size={48} strokeWidth={1.5} className="text-success" aria-hidden />
        <h1 className="type-h1 text-[26px] sm:text-[32px]">{t("confirm.title")}</h1>
        <p className="text-[14px] text-muted">{t("confirm.reference", { reference: order.reference })}</p>
        {isPreview && (
          <p className="mt-tight rounded-full bg-warning/15 px-comfortable py-inline text-[12px] font-medium text-warning">
            {t("confirm.previewNote")}
          </p>
        )}
      </div>

      {datedLines.length > 0 && (
        <div className="mb-section flex flex-wrap justify-center gap-tight">
          {datedLines.map((l) => (
            <a
              key={l.id}
              href={calendarLink(l.productName, l.booking!.date, l.booking!.startTime, l.booking!.endTime)}
              target="_blank"
              rel="noreferrer noopener"
              className="flex min-h-11 items-center gap-tight rounded-sm border border-line bg-card px-comfortable text-[13px] font-medium text-fg hover:border-strong"
            >
              <CalendarPlus size={15} strokeWidth={1.75} aria-hidden />
              {t("confirm.addToCalendar")}
            </a>
          ))}
        </div>
      )}

      <div className="mx-auto flex max-w-sm flex-col gap-section">
        {cards.map((c) => (
          <TicketCard key={c.id} data={c.data} />
        ))}
      </div>

      <div className="mt-major flex flex-col items-center gap-tight">
        {!isPreview && (
          // Client-side navigation in the SAME tab — not a new one. The mock
          // store lives in this tab's memory; a `target="_blank"` link (or any
          // hard navigation) opens a fresh, empty one that cannot find the
          // order just created, exactly the pattern `(go)/pos/complete`
          // already follows for its own print buttons.
          <button
            type="button"
            onClick={() => router.push(`/print/order/${order.id}`)}
            className="flex min-h-11 items-center gap-tight text-[14px] font-medium text-brand-foreground underline-offset-4 hover:underline"
          >
            <Download size={15} strokeWidth={1.75} aria-hidden />
            {t("confirm.downloadPrint")}
          </button>
        )}
        <Button className="mt-tight" onClick={flow.goVenue}>
          {t("confirm.bookSomethingElse")}
        </Button>
      </div>
    </StorefrontChrome>
  );
}

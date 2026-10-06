"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, Download } from "lucide-react";
import { TicketCard } from "@/components/ui";
import { ticketCards, useTicketLabels } from "@/app/print/_lib/ticketCards";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import type { Order, Ticket } from "@/lib/api/types";
import { formatClock, formatDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import { StorefrontChrome } from "../Chrome";
import { sfBtn } from "../sf";

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
    <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")}>
      <div className="mx-auto flex max-w-[720px] flex-col items-center pb-section pt-wide text-center">
        <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-full bg-success-wash text-success">
          <CheckCircle2 size={44} strokeWidth={1.5} />
        </span>
        <h1 className="mt-section text-[32px] font-semibold tracking-[-0.03em] sm:text-[40px]">{t("confirm.title")}</h1>
        <p className="tnum mt-tight text-[16px] text-muted">{t("confirm.reference", { reference: order.reference })}</p>
        <p className="mt-inline text-[16px] text-muted">{t("confirm.smsNote")}</p>
        {isPreview && (
          <p className="mt-section rounded-full bg-warning-wash px-section py-inline text-[14px] font-medium text-warning">
            {t("confirm.previewNote")}
          </p>
        )}
      </div>

      {datedLines.length > 0 && (
        <ul className="mx-auto mb-major flex max-w-[720px] flex-col divide-y divide-hairline rounded-[16px] border border-hairline">
          {datedLines.map((l) => (
            <li key={l.id} className="flex flex-col gap-comfortable p-section sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold">{l.productName}</p>
                <p className="text-[14px] text-muted">
                  {[formatDay(l.booking!.date, { weekday: true }), l.booking!.startTime ? formatClock(l.booking!.startTime) : null, l.booking!.resourceName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <a
                href={calendarLink(l.productName, l.booking!.date, l.booking!.startTime, l.booking!.endTime)}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(sfBtn.secondary, "shrink-0")}
              >
                <CalendarPlus size={18} strokeWidth={1.75} aria-hidden />
                {t("confirm.addToCalendar")}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mx-auto grid max-w-[720px] grid-cols-1 gap-section sm:grid-cols-2">
        {cards.map((c) => (
          <TicketCard key={c.id} data={c.data} />
        ))}
      </div>

      <div className="mt-major flex flex-col items-center gap-tight sm:flex-row sm:justify-center">
        {!isPreview && (
          // Client-side navigation in the SAME tab, not a new one. The mock
          // store lives in this tab's memory; a `target="_blank"` link (or any
          // hard navigation) opens a fresh, empty one that cannot find the
          // order just created, exactly the pattern `(go)/pos/complete`
          // already follows for its own print buttons.
          <button type="button" onClick={() => router.push(`/print/order/${order.id}`)} className={sfBtn.secondary}>
            <Download size={18} strokeWidth={1.75} aria-hidden />
            {t("confirm.downloadPrint")}
          </button>
        )}
        <button type="button" className={sfBtn.primary} onClick={flow.goVenue}>
          {t("confirm.bookSomethingElse")}
        </button>
      </div>
    </StorefrontChrome>
  );
}

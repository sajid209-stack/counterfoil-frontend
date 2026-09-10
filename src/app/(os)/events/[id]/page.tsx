"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import { Button, EmptyState, PageShell, StatStrip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { eventCapacity, eventRevenue, eventSold, getEvent } from "@/lib/api";
import { categoryById } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { EventTemplate } from "@/components/events/EventTemplate";
import { PreviewFrame } from "@/components/events/PreviewFrame";
import { formatMoney } from "@/lib/format";
import { demoNow } from "@/lib/schedule";

/** The event record: how it is selling, and the page itself as published. */
export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("events");
  const now = useMemo(() => demoNow(), []);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const q = useApiQuery(() => getEvent(params.id), [params.id]);
  const e = q.data;

  const labels = useMemo(() => {
    const cat = e ? categoryById(e.categoryId) : null;
    return {
      lineup: t(`section.${cat?.lineupKey ?? "lineup"}`),
      schedule: t("section.schedule"),
      about: t("section.about"),
      tickets: t("section.tickets"),
      venue: t("section.venue"),
      faq: t("section.faq"),
      gallery: t("section.gallery"),
      soldOut: t("soldOut"),
      free: t("free"),
      from: t("from"),
      getTickets: t("getTickets"),
      addToCalendar: t("addToCalendar"),
      doorsOpen: t("doorsOpen"),
      left: t("left"),
      countdownDays: t("countdown.days"),
      countdownHours: t("countdown.hours"),
      countdownMins: t("countdown.mins"),
    };
  }, [t, e]);

  if (!q.loading && (q.error || !e)) {
    return (
      <PageShell title={t("title")}>
        <EmptyState
          title={t("emptyTitle")}
          action={<Link href="/events"><Button>{t("title")}</Button></Link>}
        />
      </PageShell>
    );
  }

  const width = device === "mobile" ? 390 : 1180;

  return (
    <PageShell title={e?.title ?? t("title")} description={e?.venueName}>
      <div className={cn("flex flex-col gap-section pb-hero", templateFontVars)}>
        <Link href="/events" className="mb-section inline-flex items-center gap-inline text-[13px] text-muted hover:text-fg">
          <ArrowLeft size={14} strokeWidth={1.5} /> {t("title")}
        </Link>

        {e && (
          <StatStrip
            items={[
              { key: "sold", label: t("stat.sold"), value: `${eventSold(e).toLocaleString()} / ${eventCapacity(e).toLocaleString()}` },
              { key: "revenue", label: t("stat.revenue"), value: formatMoney(eventRevenue(e)) },
              { key: "tiers", label: t("section.tickets"), value: String(e.tiers.length) },
              { key: "state", label: t("col.status"), value: e.published ? t("state.published") : t("state.draft") },
            ]}
          />
        )}

        {e && (
          <div className="card-surface overflow-hidden">
            <div className="flex items-center justify-between gap-tight border-b border-line px-major py-comfortable">
              <h2 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("customise.preview")}</h2>
              <div className="flex shrink-0 items-center gap-inline">
                {([["desktop", Monitor], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevice(d)}
                    aria-label={t(`device.${d}`)}
                    aria-pressed={device === d}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-sm transition-colors duration-quick sm:h-9 sm:w-9",
                      device === d ? "bg-inverse text-inverse-fg" : "text-muted hover:bg-subtle hover:text-fg",
                    )}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-subtle p-comfortable">
              <div className="mx-auto overflow-hidden rounded-sm shadow-md" style={{ maxWidth: width }}>
                <PreviewFrame width={width}>
                  <EventTemplate event={e} device={device} labels={labels} now={now} />
                </PreviewFrame>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

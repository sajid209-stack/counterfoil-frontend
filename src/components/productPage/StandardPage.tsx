"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Check, ChevronDown, Clock, MapPin, Navigation, Tag } from "lucide-react";
import { BackLink, directionsHref } from "@/app/s/_components/Chrome";
import { Media, sfBtn, typeGroup } from "@/app/s/_components/sf";
import { BookingPicker } from "@/app/s/_components/flow/BookingPicker";
import { cn } from "@/lib/cn";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { formatDuration } from "@/lib/duration";
import { formatClockRange, formatDay } from "@/lib/format";
import { eventDays } from "@/lib/api/eventModel";
import type { PageSectionId, Product } from "@/lib/api/types";
import { pageOf } from "@/lib/productPage";
import { productMinutes } from "@/lib/storefront/facts";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { scheduleHoursOn, storefrontPattern } from "@/lib/storefront/pattern";
import { PageFrame } from "./PageFrame";
import { VideoBlock } from "./VideoBlock";

const isoOfLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The sections this page can draw below the hero, in the order the page lists
 *  them. Hero and the booking panel are always drawn and are not in this list. */
const BODY_SECTIONS: PageSectionId[] = ["about", "highlights", "included", "know", "gallery", "video", "faq", "venue"];

/**
 * The standard page: the look every item has until it is given another.
 *
 * Photos, name, tagline and fact chips; a booking panel that stays beside the
 * page on a wide screen; and the sections the item's page lists, in its order.
 * It is driven entirely by `pageOf(product)`, so the page an operator designs
 * in the Catalog is the page a customer reads, and an item nobody designed
 * still gets a good one from what it already knows.
 *
 * The layout follows the window's breakpoints, as every storefront page does:
 * the designer shows a device width by drawing the page in a frame of that
 * width (an iframe), whose own window is the width being previewed. Container
 * queries would be the other way to do it, but a container is a containing
 * block for fixed children and would carry the phone's booking bar off the
 * bottom of the screen.
 */
export function StandardPage({ product, chrome }: { product: Product; chrome: "storefront" | "link" | "none" }) {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const subtitle = useBehaviourSubtitle();
  const [picked, setPicked] = useState(0);

  const page = pageOf(product);
  const listed = new Set(page.sections);
  const images = product.images ?? [];
  const cover = page.coverUrl || null;
  const hasGallery = listed.has("gallery") && images.length > 0 && (images.length > 1 || !!cover);
  const main = cover ?? images[Math.min(picked, Math.max(0, images.length - 1))]?.url;
  const mainAlt = cover ? product.name : (images[Math.min(picked, Math.max(0, images.length - 1))]?.alt ?? product.name);
  const showThumbs = !cover && !hasGallery && images.length > 1;
  const minutes = productMinutes(product);
  const pol = product.policies;
  const pattern = storefrontPattern(product.bookingType);
  const ev = product.event;

  /* A product with its own schedule may legitimately trade on a different
     clock than the venue's front gate (a turf selling until 11pm inside a venue
     whose general hours read "closes 6pm"), so the hours stated here are the
     ones the time grid is built from, not the venue's general hours, or the two
     would contradict each other on the same screen. */
  let hoursLine: string | null = null;
  if (pattern === "event") {
    hoursLine = null;
  } else if (pattern !== "open" && product.schedule) {
    const { startTime, endTime } = scheduleHoursOn(product.schedule, isoOfLocalDate(flow.now));
    hoursLine = t("openToday", { hours: formatClockRange(startTime, endTime) });
  } else {
    const todays = flow.location.openingHours.find((h) => h.dayOfWeek === flow.now.getDay());
    hoursLine = todays?.intervals.length
      ? t("openToday", { hours: todays.intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", ") })
      : t("closedToday");
  }

  const eventWhen = ev
    ? (() => {
        const days = eventDays({ id: product.id, startsAt: ev.startsAt, days: ev.days });
        const first = formatDay(days[0].date, { weekday: true });
        return days.length > 1 ? `${first} – ${formatDay(days[days.length - 1].date, { weekday: true })}` : first;
      })()
    : null;

  const know: string[] = [t("know.instant"), t("know.sms")];
  if (pol?.cancellation === "free_until") know.push(pol.cancelHours > 0 ? t("know.freeCancel", { hours: pol.cancelHours }) : t("know.freeCancelAny"));
  else if (pol?.cancellation === "fee") know.push(t("know.feeCancel", { hours: pol.cancelHours, pct: pol.cancelFeePct }));
  else if (pol?.cancellation === "none") know.push(t("know.noCancel"));
  if (pol?.reschedule === "until" && pol.rescheduleHours > 0) know.push(t("know.reschedule", { hours: pol.rescheduleHours }));

  const includedTiers = product.tiers.filter((x) => x.active && (x.note || (x.perks && x.perks.length > 0)));
  const video = page.videoUrl;
  const faq = page.faq.filter((f) => f.q.trim());
  const highlights = page.highlights.filter((h) => h.label.trim());
  const info = page.info.filter((r) => r.label.trim() && r.value.trim());

  const venueName = ev?.venueName || flow.location.name;
  const venueAddress = ev?.venueName
    ? (ev.venueAddress ?? "")
    : [flow.location.addressLine1, flow.location.addressLine2, flow.location.city].filter(Boolean).join(", ");
  const venueHref = ev?.venueName
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([ev.venueName, ev.venueAddress].filter(Boolean).join(", "))}`
    : directionsHref(flow.location);

  const fact = "inline-flex min-h-8 items-center gap-tight rounded-full border border-line px-comfortable text-base";
  const h2 = "text-xl font-semibold";

  const sections: Record<string, React.ReactNode> = {
    about: product.description ? (
      <section key="about">
        <h2 className={h2}>{t("about")}</h2>
        <p className="mt-tight max-w-[62ch] whitespace-pre-line text-md leading-relaxed">{product.description}</p>
      </section>
    ) : null,

    highlights: highlights.length ? (
      <section key="highlights">
        <h2 className={h2}>{t("page.highlights")}</h2>
        <ul className="mt-tight grid grid-cols-1 gap-tight sm:grid-cols-2">
          {highlights.map((h) => (
            <li key={h.id} className="rounded-lg border border-hairline p-section">
              <p className="text-md font-semibold">{h.label}</p>
              {h.description && <p className="mt-inline text-base text-muted">{h.description}</p>}
            </li>
          ))}
        </ul>
      </section>
    ) : null,

    included: includedTiers.length ? (
      <section key="included">
        <h2 className={h2}>{t("page.included")}</h2>
        <ul className="mt-tight flex flex-col gap-tight">
          {includedTiers.map((tr) => (
            <li key={tr.id} className="rounded-lg border border-hairline p-section">
              <p className="text-md font-semibold">{tr.name}</p>
              {tr.note && <p className="mt-inline text-base text-muted">{tr.note}</p>}
              {tr.perks && tr.perks.length > 0 && (
                <ul className="mt-tight flex flex-col gap-inline">
                  {tr.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-comfortable text-base">
                      <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-brand-foreground" aria-hidden />
                      {perk}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    ) : null,

    know: (
      <section key="know">
        <h2 className={h2}>{t("know.title")}</h2>
        <ul className="mt-tight flex flex-col gap-tight">
          {know.map((k) => (
            <li key={k} className="flex items-start gap-comfortable text-md">
              <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ember-wash text-brand-foreground">
                <Check size={14} strokeWidth={2.5} />
              </span>
              {k}
            </li>
          ))}
        </ul>
        {info.length > 0 && (
          <dl className="mt-section divide-y divide-hairline rounded-lg border border-hairline">
            {info.map((r) => (
              <div key={r.id} className="flex flex-col gap-inline p-section sm:flex-row sm:gap-section">
                <dt className="text-base font-semibold sm:w-40 sm:shrink-0">{r.label}</dt>
                <dd className="min-w-0 break-words text-base text-muted">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    ),

    gallery: hasGallery ? (
      <section key="gallery">
        <h2 className={h2}>{t("page.gallery")}</h2>
        <ul className="mt-tight grid grid-cols-2 gap-tight sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id}>
              <Media
                src={img.url}
                alt={img.alt ?? t("page.photoOf", { n: i + 1, total: images.length })}
                bookingType={product.bookingType}
                seed={img.id}
                className="aspect-[4/3] w-full rounded-md"
              />
            </li>
          ))}
        </ul>
      </section>
    ) : null,

    video: video ? (
      <section key="video">
        <h2 className={h2}>{t("page.video")}</h2>
        <div className="mt-tight">
          <VideoBlock url={video} title={product.name} />
        </div>
      </section>
    ) : null,

    faq: faq.length ? (
      <section key="faq">
        <h2 className={h2}>{t("page.faq")}</h2>
        <div className="mt-tight divide-y divide-hairline rounded-lg border border-hairline">
          {faq.map((f) => (
            <details key={f.id} className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-comfortable px-section py-comfortable text-md font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown size={18} strokeWidth={1.75} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-section pb-section text-base text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    ) : null,

    venue: (
      <section key="venue">
        <h2 className={h2}>{t("where")}</h2>
        <div className="mt-tight flex flex-col gap-comfortable rounded-lg border border-hairline p-section sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-comfortable text-md">
            <MapPin size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <span>
              {venueName}
              {venueAddress && (
                <>
                  <br />
                  <span className="text-base text-muted">{venueAddress}</span>
                </>
              )}
            </span>
          </p>
          <a
            href={venueHref}
            target="_blank"
            rel="noreferrer noopener"
            onClick={flow.inert ? (e) => e.preventDefault() : undefined}
            className={cn(sfBtn.secondary, "shrink-0")}
          >
            <Navigation size={18} strokeWidth={1.75} aria-hidden />
            {t("directions")}
          </a>
        </div>
      </section>
    ),
  };

  /* The page's own order, deduplicated, and only what it lists. */
  const order = [...new Set(page.sections)].filter((s) => BODY_SECTIONS.includes(s));

  return (
    <PageFrame product={product} chrome={chrome} accent={page.accent ?? null}>
      <div>
        {chrome === "storefront" && !flow.link && (
          <div className="pt-section">
            <BackLink
              label={t("backToVenue", { venue: flow.location.name })}
              href={flow.mode === "live" && !flow.inert ? `/s/${flow.storefront.slug}` : undefined}
              onClick={flow.inert ? () => {} : undefined}
            />
          </div>
        )}
        {chrome !== "storefront" && <div className="pt-section" />}

        <article className="mt-tight grid grid-cols-1 gap-major lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-hero lg:gap-y-major">
          {/* Cover, name, tagline, facts */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <Media
              src={main}
              alt={mainAlt}
              bookingType={product.bookingType}
              seed={product.id}
              iconSize={40}
              className="aspect-[16/10] w-full rounded-lg lg:aspect-[16/9]"
            />
            {showThumbs && (
              <ul className="mt-tight flex gap-tight overflow-x-auto">
                {images.map((img, i) => (
                  <li key={img.id} className="shrink-0">
                    <button
                      type="button"
                      aria-label={img.alt ?? product.name}
                      aria-pressed={i === picked}
                      onClick={() => setPicked(i)}
                      className={cn("block h-14 w-20 overflow-hidden rounded-md border-2", i === picked ? "border-ember-solid" : "border-transparent")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- bundled/local assets */}
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h1 className="mt-major break-words text-balance text-4xl font-semibold leading-tight tracking-figure lg:text-display">
              {product.name}
            </h1>
            {page.tagline && <p className="mt-tight max-w-[56ch] text-lg text-muted">{page.tagline}</p>}
            <ul className="mt-section flex flex-wrap gap-tight">
              <li className={fact}>
                <Tag size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
                {t(`filter.${typeGroup(product.bookingType)}`)}
              </li>
              {eventWhen && (
                <li className={fact}>
                  <CalendarClock size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
                  {eventWhen}
                </li>
              )}
              {minutes !== null && (
                <li className={fact}>
                  <Clock size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
                  {formatDuration(minutes)}
                </li>
              )}
              {hoursLine && (
                <li className={fact}>
                  <Clock size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
                  {hoursLine}
                </li>
              )}
            </ul>
            {!page.tagline && pattern !== "event" && (
              <p className="mt-section text-md text-muted">{subtitle(product, { resources: flow.resources, team: flow.team })}</p>
            )}
          </div>

          {/* The booking panel: always drawn. */}
          <aside
            aria-label={t("booking.panelLabel")}
            id="tickets"
            className="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:self-start lg:rounded-lg lg:border lg:border-line lg:bg-card lg:p-major lg:shadow-card"
          >
            <BookingPicker product={product} />
          </aside>

          {/* The sections the page lists, in its order */}
          <div className="flex min-w-0 flex-col gap-major lg:col-start-1 lg:row-start-2">
            {order.map((s) => sections[s] ?? null)}
            {/* Room for the phone's fixed booking bar. */}
            <div aria-hidden className="h-40 lg:hidden" />
          </div>
        </article>
      </div>
    </PageFrame>
  );
}

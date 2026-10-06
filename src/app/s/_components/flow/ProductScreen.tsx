"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Clock, MapPin, Navigation, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { formatDuration } from "@/lib/duration";
import { formatClockRange } from "@/lib/format";
import { productMinutes } from "@/lib/storefront/facts";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { scheduleHoursOn, storefrontPattern } from "@/lib/storefront/pattern";
import { BackLink, StorefrontChrome, StorefrontMissing, directionsHref } from "../Chrome";
import { Media, sfBtn, typeGroup } from "../sf";
import { BookingPicker } from "./BookingPicker";

const isoOfLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * One booking, ready to buy.
 *
 * The photos, the name, the facts and what to know sit on the left; the
 * booking panel sits beside them on a desktop, sticky, so choosing and paying
 * never leave the screen. On a phone the panel follows the facts and its total
 * and buttons are fixed to the bottom.
 */
export function ProductScreen({ productId }: { productId: string }) {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const subtitle = useBehaviourSubtitle();
  const [picked, setPicked] = useState(0);

  const product = flow.products.find((p) => p.id === productId);
  if (!product) return <StorefrontMissing title={t("missingBookingTitle")} message={t("missingBookingBody")} />;

  const images = product.images ?? [];
  const main = images[Math.min(picked, Math.max(0, images.length - 1))];
  const minutes = productMinutes(product);
  const pol = product.policies;

  /* A product with its own schedule may legitimately trade on a different
     clock than the venue's front gate (a turf selling until 11pm inside a venue
     whose general hours read "closes 6pm"), so the hours stated here are the
     ones the time grid below is built from, not the venue's general hours, or
     the two would contradict each other on the same screen. */
  const pattern = storefrontPattern(product.bookingType);
  let hoursLine: string | null = null;
  if (pattern !== "open" && product.schedule) {
    const { startTime, endTime } = scheduleHoursOn(product.schedule, isoOfLocalDate(flow.now));
    hoursLine = t("openToday", { hours: formatClockRange(startTime, endTime) });
  } else {
    const todays = flow.location.openingHours.find((h) => h.dayOfWeek === flow.now.getDay());
    hoursLine = todays?.intervals.length
      ? t("openToday", { hours: todays.intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", ") })
      : t("closedToday");
  }

  const know: string[] = [t("know.instant"), t("know.sms")];
  if (pol?.cancellation === "free_until") know.push(pol.cancelHours > 0 ? t("know.freeCancel", { hours: pol.cancelHours }) : t("know.freeCancelAny"));
  else if (pol?.cancellation === "fee") know.push(t("know.feeCancel", { hours: pol.cancelHours, pct: pol.cancelFeePct }));
  else if (pol?.cancellation === "none") know.push(t("know.noCancel"));
  if (pol?.reschedule === "until" && pol.rescheduleHours > 0) know.push(t("know.reschedule", { hours: pol.rescheduleHours }));

  const fact = "inline-flex min-h-8 items-center gap-tight rounded-full border border-line px-comfortable text-[14px]";

  return (
    <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")}>
      <div className="pt-section">
        <BackLink
          label={t("backToVenue", { venue: flow.location.name })}
          href={flow.mode === "live" ? `/s/${flow.storefront.slug}` : undefined}
        />
      </div>

      <article className="mt-tight grid grid-cols-1 gap-major lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-hero lg:gap-y-major">
        {/* Photos, name, facts */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Media
            src={main?.url}
            alt={main?.alt ?? product.name}
            bookingType={product.bookingType}
            seed={product.id}
            iconSize={40}
            className="aspect-[16/10] w-full rounded-[20px] lg:aspect-[16/9]"
          />
          {images.length > 1 && (
            <ul className="mt-tight flex gap-tight overflow-x-auto">
              {images.map((img, i) => (
                <li key={img.id} className="shrink-0">
                  <button
                    type="button"
                    aria-label={img.alt ?? product.name}
                    aria-pressed={i === picked}
                    onClick={() => setPicked(i)}
                    className={cn("block h-14 w-20 overflow-hidden rounded-[10px] border-2", i === picked ? "border-[var(--sf-fill)]" : "border-transparent")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- bundled/local assets */}
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h1 className="mt-major break-words text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
            {product.name}
          </h1>
          <ul className="mt-section flex flex-wrap gap-tight">
            <li className={fact}>
              <Tag size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
              {t(`filter.${typeGroup(product.bookingType)}`)}
            </li>
            {minutes !== null && (
              <li className={fact}>
                <Clock size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
                {formatDuration(minutes)}
              </li>
            )}
            <li className={fact}>
              <Clock size={14} strokeWidth={1.75} className="text-muted" aria-hidden />
              {hoursLine}
            </li>
          </ul>
          <p className="mt-section text-[16px] text-muted">{subtitle(product, { resources: flow.resources, team: flow.team })}</p>
        </div>

        {/* The booking panel */}
        <aside
          aria-label={t("booking.panelLabel")}
          className="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:self-start lg:rounded-[20px] lg:border lg:border-line lg:bg-white lg:p-major lg:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
        >
          <BookingPicker product={product} />
        </aside>

        {/* About, what to know, where */}
        <div className="flex min-w-0 flex-col gap-major lg:col-start-1 lg:row-start-2">
          {product.description && (
            <section>
              <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{t("about")}</h2>
              <p className="mt-tight max-w-[62ch] text-[16px] leading-relaxed">{product.description}</p>
            </section>
          )}

          <section>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{t("know.title")}</h2>
            <ul className="mt-tight flex flex-col gap-tight">
              {know.map((k) => (
                <li key={k} className="flex items-start gap-comfortable text-[16px]">
                  <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sf-soft)] text-[var(--sf-ink)]">
                    <Check size={14} strokeWidth={2.5} />
                  </span>
                  {k}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{t("where")}</h2>
            <div className="mt-tight flex flex-col gap-comfortable rounded-[16px] border border-hairline p-section sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-comfortable text-[16px]">
                <MapPin size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                <span>
                  {flow.location.name}
                  <br />
                  <span className="text-[14px] text-muted">
                    {[flow.location.addressLine1, flow.location.addressLine2, flow.location.city].filter(Boolean).join(", ")}
                  </span>
                </span>
              </p>
              <a href={directionsHref(flow.location)} target="_blank" rel="noreferrer noopener" className={cn(sfBtn.secondary, "shrink-0")}>
                <Navigation size={18} strokeWidth={1.75} aria-hidden />
                {t("directions")}
              </a>
            </div>
          </section>
          {/* Room for the phone's fixed booking bar. */}
          <div aria-hidden className="h-40 lg:hidden" />
        </div>
      </article>
    </StorefrontChrome>
  );
}

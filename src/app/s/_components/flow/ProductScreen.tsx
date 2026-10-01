"use client";

import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { ProductThumb } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { formatClockRange } from "@/lib/format";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { scheduleHoursOn, storefrontPattern } from "@/lib/storefront/pattern";
import { ACCENT_WASH, StorefrontChrome, StorefrontMissing } from "../Chrome";
import { BookingPicker } from "./BookingPicker";

const isoOfLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * One booking, ready to buy.
 *
 * Everything above the booking picker is the venue's own `StorefrontProductPage`
 * (what it is, what it costs) — this is the part that used to end in
 * "How to book: come to the counter". It now ends in a basket.
 */
export function ProductScreen({ productId }: { productId: string }) {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");
  const subtitle = useBehaviourSubtitle();

  const product = flow.products.find((p) => p.id === productId);
  if (!product) return <StorefrontMissing title={t("missingBookingTitle")} message={t("missingBookingBody")} />;

  const accent = flow.storefront.accent ?? null;

  return (
    <StorefrontChrome
      storefront={flow.storefront}
      location={flow.location}
      backHref={flow.mode === "live" ? `/s/${flow.storefront.slug}` : undefined}
      backLabel={t("backToVenue", { venue: flow.location.name })}
      poweredBy={t("poweredBy")}
      preview={flow.mode === "preview"}
    >
      {flow.mode === "preview" && (
        <button
          type="button"
          onClick={flow.goVenue}
          className="mb-section flex min-h-11 items-center text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {t("backToVenue", { venue: flow.location.name })}
        </button>
      )}
      <article>
        <header className="flex flex-col gap-comfortable sm:flex-row sm:items-start">
          <ProductThumb images={product.images} name={product.name} bookingType={product.bookingType} size="thumb" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="type-h1 break-words text-[26px] sm:text-[32px]">{product.name}</h1>
            <p className="mt-tight text-[14px] text-muted">{subtitle(product, { resources: flow.resources, team: flow.team })}</p>
          </div>
        </header>

        {product.description && (
          <p className="mt-section max-w-2xl text-[15px] leading-relaxed text-fg/85">{product.description}</p>
        )}

        <section className={cn("mt-major rounded-md p-card", accent ? ACCENT_WASH[accent] : "bg-subtle")}>
          <p className="flex items-start gap-tight text-[13px] text-fg/80">
            <MapPin size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <span>
              {flow.location.addressLine1}
              {flow.location.addressLine2 ? <>, {flow.location.addressLine2}</> : null}
              {", "}
              {[flow.location.city, flow.location.country].filter(Boolean).join(", ")}
            </span>
          </p>
          {(() => {
            // A product with its own schedule may legitimately trade on a
            // different clock than the venue's front gate (a turf selling
            // until 11pm inside a venue whose general hours read "closes
            // 6pm") — so the hours stated here must be the ones the time
            // grid below is actually built from, not the venue's general
            // hours, or the two would contradict each other on the same
            // screen.
            const pattern = storefrontPattern(product.bookingType);
            if (pattern !== "open" && product.schedule) {
              const todayIso = isoOfLocalDate(flow.now);
              const { startTime, endTime } = scheduleHoursOn(product.schedule, todayIso);
              return (
                <p className="mt-tight text-[13px] font-medium">
                  {t("openToday", { hours: formatClockRange(startTime, endTime) })}
                </p>
              );
            }
            const todays = flow.location.openingHours.find((h) => h.dayOfWeek === flow.now.getDay());
            return todays?.intervals.length ? (
              <p className="mt-tight text-[13px] font-medium">
                {t("openToday", {
                  hours: todays.intervals.map((i) => formatClockRange(i.opensAt, i.closesAt)).join(", "),
                })}
              </p>
            ) : (
              <p className="mt-tight text-[13px] text-muted">{t("closedToday")}</p>
            );
          })()}
        </section>

        <section className="mt-major">
          <BookingPicker product={product} />
        </section>
      </article>
    </StorefrontChrome>
  );
}

"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin, Ticket, Users } from "lucide-react";
import { ProductThumb } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getStorefrontPage, listResources, listStaff, type PriceTier } from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { formatMoney } from "@/lib/format";
import { demoNow } from "@/lib/schedule";
import { ACCENT_BG, ACCENT_WASH, StorefrontChrome, StorefrontMissing } from "../../_components/Chrome";

/**
 * One booking, on a venue's public page.
 *
 * The page's whole job is the middle section: the **variants**. A price list
 * with three numbers and no difference stated is not a choice, which is why
 * `PriceTier` gained a `note` — what a ticket includes, in the operator's own
 * words. General, Regular and VIP is exactly the shape this draws; what they
 * are called is the operator's to type, because the tier names are theirs.
 *
 * It does not sell. See the venue page for why, and for the shape of the thing
 * that would.
 */
export default function StorefrontProductPage() {
  const params = useParams<{ slug: string; product: string }>();
  const t = useTranslations("storefront");
  const now = useMemo(() => demoNow(), []);
  const q = useApiQuery(() => getStorefrontPage(params.slug), [params.slug]);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);

  if (q.loading) {
    return (
      <div className="min-h-screen bg-surface px-gutter py-hero" aria-busy="true">
        <div className="mx-auto max-w-3xl animate-pulse space-y-section">
          <div className="h-8 w-2/3 rounded-sm bg-line" />
          <div className="h-32 rounded-md bg-line/60" />
        </div>
      </div>
    );
  }
  if (!q.data) return <StorefrontMissing title={t("missingTitle")} message={t("missingBody")} />;

  const { storefront: sf, location, products, slugs } = q.data;
  const product = products.find((p) => slugs[p.id] === params.product);
  if (!product) return <StorefrontMissing title={t("missingBookingTitle")} message={t("missingBookingBody")} />;

  const accent = sf.accent ?? null;
  const tiers = product.tiers.filter((x) => x.active);
  const resources = resourcesQ.data?.data ?? [];
  const team = staffQ.data?.data ?? [];
  const today = location.openingHours.find((h) => h.dayOfWeek === now.getDay());
  const openToday = today && today.intervals.length > 0;

  /** What a tier costs, said the way somebody buying reads it. A donation tier
   *  is a floor, not a price, and calling it one would be wrong. */
  const priceLine = (tier: PriceTier) =>
    tier.donation ? t("donationFrom", { price: formatMoney(tier.price) }) : tier.price === 0 ? t("free") : formatMoney(tier.price);

  return (
    <StorefrontChrome
      storefront={sf}
      location={location}
      backHref={`/s/${sf.slug}`}
      backLabel={t("backToVenue", { venue: location.name })}
      poweredBy={t("poweredBy")}
    >
      <article>
        <header className="flex flex-col gap-comfortable sm:flex-row sm:items-start">
          <ProductThumb images={product.images} name={product.name} bookingType={product.bookingType} size="thumb" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="type-h1 break-words text-[26px] sm:text-[32px]">{product.name}</h1>
            <p className="mt-tight text-[14px] text-muted">{behaviourSubtitle(product, { resources, team })}</p>
          </div>
        </header>

        {product.description && (
          <p className="mt-section max-w-2xl text-[15px] leading-relaxed text-fg/85">{product.description}</p>
        )}

        {/* The variants. Cards rather than a table: each one is a decision with
            a reason attached, and a table would put four reasons in a column
            nobody reads. */}
        <section className="mt-major">
          <h2 className="text-base font-semibold tracking-[-0.4px]">{t("tickets")}</h2>
          {tiers.length === 0 ? (
            <p className="mt-comfortable text-[14px] text-muted">{t("askAtTheDoor")}</p>
          ) : (
            <ul className="mt-section grid grid-cols-1 gap-section sm:grid-cols-2">
              {tiers.map((tier) => (
                <li key={tier.id} className="card-surface flex flex-col gap-tight p-card">
                  <div className="flex items-baseline justify-between gap-comfortable">
                    <p className="min-w-0 break-words text-[16px] font-semibold">{tier.name}</p>
                    <p className="shrink-0 whitespace-nowrap text-[16px] font-semibold">{priceLine(tier)}</p>
                  </div>
                  {/* The two facts a tier carries that its name does not: who it
                      is for, and how many people it lets in. */}
                  {(tier.ageNote || (tier.admits ?? 1) > 1) && (
                    <p className="flex flex-wrap items-center gap-comfortable text-[13px] text-muted">
                      {tier.ageNote && (
                        <span className="inline-flex items-center gap-inline">
                          <Users size={14} strokeWidth={1.5} aria-hidden />
                          {tier.ageNote}
                        </span>
                      )}
                      {(tier.admits ?? 1) > 1 && (
                        <span className="inline-flex items-center gap-inline">
                          <Ticket size={14} strokeWidth={1.5} aria-hidden />
                          {t("admits", { count: tier.admits ?? 1 })}
                        </span>
                      )}
                    </p>
                  )}
                  {tier.note && <p className="text-[14px] leading-relaxed text-fg/80">{tier.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Where it is bought. The page is honest about this rather than
            drawing a button that cannot do anything: online checkout is not
            built, and a dead Buy button is worse than a sentence. */}
        <section className={cn("mt-major rounded-md p-card", accent ? ACCENT_WASH[accent] : "bg-subtle")}>
          <div className="flex flex-wrap items-start gap-comfortable">
            {accent && <span aria-hidden className={cn("mt-1 h-6 w-1 shrink-0 rounded-full", ACCENT_BG[accent])} />}
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-[-0.4px]">{t("howToBook")}</h2>
              <p className="mt-tight max-w-xl text-[14px] leading-relaxed text-fg/85">{t("howToBookBody", { venue: location.name })}</p>
              <p className="mt-comfortable flex items-start gap-tight text-[14px]">
                <MapPin size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                <span>
                  {location.addressLine1}
                  {location.addressLine2 ? <>, {location.addressLine2}</> : null}
                  {", "}
                  {[location.city, location.country].filter(Boolean).join(", ")}
                </span>
              </p>
              <p className={cn("mt-tight text-[14px] font-medium", openToday ? "text-fg" : "text-muted")}>
                {openToday
                  ? t("openToday", { hours: today!.intervals.map((i) => `${i.opensAt}–${i.closesAt}`).join(", ") })
                  : t("closedToday")}
              </p>
            </div>
          </div>
        </section>
      </article>
    </StorefrontChrome>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { ProductThumb } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getStorefrontPage, listResources, listStaff } from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { formatPriceShort } from "@/lib/format";
import { demoNow } from "@/lib/schedule";
import { ACCENT_WASH, StorefrontChrome, StorefrontMissing } from "../_components/Chrome";

/** Monday first, the way the rest of the app reads a week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * A venue's public page.
 *
 * What it is for, stated plainly because it decides everything below: it
 * **publishes**, it does not sell. Online checkout is deferred in this project,
 * so a page that put a basket on screen would be promising a flow that does not
 * exist. It answers the three questions somebody has before they set out —
 * what is on, what it costs, and when you are open — and says where it is
 * bought. The contract is shaped so a basket can be added later without moving
 * any of this.
 */
export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const t = useTranslations("storefront");
  const now = useMemo(() => demoNow(), []);
  const q = useApiQuery(() => getStorefrontPage(params.slug), [params.slug]);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);

  if (q.loading) {
    return (
      <div className="min-h-screen bg-surface px-gutter py-hero" aria-busy="true">
        <div className="mx-auto max-w-5xl animate-pulse space-y-section">
          <div className="h-8 w-2/3 rounded-sm bg-line" />
          <div className="h-4 w-1/2 rounded-sm bg-line" />
          <div className="h-44 rounded-md bg-line/60" />
        </div>
      </div>
    );
  }
  if (!q.data) return <StorefrontMissing title={t("missingTitle")} message={t("missingBody")} />;

  const { storefront: sf, location, products, slugs } = q.data;
  const accent = sf.accent ?? null;
  const resources = resourcesQ.data?.data ?? [];
  const team = staffQ.data?.data ?? [];

  const today = location.openingHours.find((h) => h.dayOfWeek === now.getDay());
  const openToday = today && today.intervals.length > 0;
  const dayName = (d: number) => new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(2026, 6, 5 + d));

  /** The cheapest active tier, which is what a public card says. */
  const fromPrice = (tiers: { price: number; active: boolean }[]) => {
    const open = tiers.filter((x) => x.active);
    return open.length ? Math.min(...open.map((x) => x.price)) : null;
  };

  return (
    <StorefrontChrome storefront={sf} location={location} poweredBy={t("poweredBy")}>
      {/* The venue, in its own words. The accent is a rule and a wash rather
          than a letterform: the hue is a ground here, never text, which is the
          rule ember has carried across this product since September. */}
      <section className={cn("rounded-md p-card", accent ? ACCENT_WASH[accent] : "bg-subtle")}>
        {/* fg/75, not `muted`: muted is tuned against the card, and on the
            accent's own wash it measured 4.34:1 — the same fault the check-in
            screen's amber panel had. A dimmed inherit composites against
            whatever wash it is actually sitting on. */}
        <p className="type-label text-[12px] text-fg/75">{[location.addressLine1, location.city].filter(Boolean).join(" · ")}</p>
        <h1 className="type-h1 mt-tight max-w-3xl text-balance break-words text-[26px] sm:text-[34px]">
          {sf.headline || location.name}
        </h1>
        {sf.intro && <p className="mt-comfortable max-w-2xl text-[15px] leading-relaxed text-fg/80">{sf.intro}</p>}
        <p className="mt-section flex flex-wrap items-center gap-tight text-[13px]">
          {/* The dot carries the colour; the words stay on ink. */}
          <span className={cn("inline-flex items-center gap-inline font-medium", openToday ? "text-fg" : "text-muted")}>
            <span aria-hidden className={cn("h-2 w-2 rounded-full", openToday ? "bg-success" : "bg-muted")} />
            {openToday
              ? t("openToday", { hours: today!.intervals.map((i) => `${i.opensAt}–${i.closesAt}`).join(", ") })
              : t("closedToday")}
          </span>
        </p>
      </section>

      {/* What's on. A card states what a booking IS and what it costs, and
          nothing about availability — a public page that promised a specific
          slot would be promising something only the till can hold. */}
      <section className="mt-major">
        <h2 className="text-base font-semibold tracking-[-0.4px]">{t("whatsOn")}</h2>
        {products.length === 0 ? (
          <p className="mt-comfortable text-[14px] text-muted">{t("nothingOn")}</p>
        ) : (
          <ul className="mt-section grid grid-cols-1 gap-section sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const from = fromPrice(p.tiers);
              return (
                <li key={p.id}>
                  <Link
                    href={`/s/${sf.slug}/${slugs[p.id]}`}
                    className="card-surface flex h-full flex-col gap-tight p-card transition-transform duration-quick hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-comfortable">
                      <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="card" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[15px] font-semibold leading-snug">{p.name}</p>
                        <p className="mt-inline text-[13px] text-muted">{behaviourSubtitle(p, { resources, team })}</p>
                      </div>
                    </div>
                    <p className="mt-auto flex items-baseline justify-between gap-tight pt-tight">
                      <span className="text-[15px] font-semibold">
                        {from === null ? t("askAtTheDoor") : from === 0 ? t("free") : t("fromPrice", { price: formatPriceShort(from) })}
                      </span>
                      <ArrowRight size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Getting here, and the week. Two columns on a desktop because they are
          read together and neither is long enough to earn a section. */}
      <section className="mt-major grid grid-cols-1 gap-section lg:grid-cols-2">
        <div className="card-surface p-card">
          <h2 className="text-base font-semibold tracking-[-0.4px]">{t("gettingHere")}</h2>
          <p className="mt-comfortable flex items-start gap-tight text-[14px]">
            <MapPin size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden />
            <span>
              {location.addressLine1}
              {location.addressLine2 ? <>, {location.addressLine2}</> : null}
              <br />
              {[location.city, location.country].filter(Boolean).join(", ")}
            </span>
          </p>
          {sf.contactPhone && (
            <p className="mt-tight flex items-center gap-tight text-[14px]">
              <Phone size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
              <a href={`tel:${sf.contactPhone}`} className="underline-offset-4 hover:underline">{sf.contactPhone}</a>
            </p>
          )}
          {sf.contactEmail && (
            <p className="mt-tight flex items-center gap-tight text-[14px]">
              <Mail size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
              <a href={`mailto:${sf.contactEmail}`} className="break-all underline-offset-4 hover:underline">{sf.contactEmail}</a>
            </p>
          )}
          {sf.links.length > 0 && (
            <ul className="mt-section flex flex-col gap-inline border-t border-hairline pt-comfortable">
              {sf.links.map((l) => (
                <li key={l.id}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[14px] text-brand-foreground underline-offset-4 hover:underline"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-surface p-card">
          <h2 className="text-base font-semibold tracking-[-0.4px]">{t("openingHours")}</h2>
          {location.openingHours.length === 0 ? (
            <p className="mt-comfortable text-[14px] text-muted">{t("hoursUnknown")}</p>
          ) : (
            <dl className="mt-comfortable flex flex-col">
              {WEEK_ORDER.map((d) => {
                const row = location.openingHours.find((h) => h.dayOfWeek === d);
                const open = row && row.intervals.length > 0;
                const isToday = d === now.getDay();
                return (
                  <div
                    key={d}
                    className={cn(
                      "flex items-baseline justify-between gap-comfortable border-b border-hairline py-tight last:border-b-0 text-[14px]",
                      isToday && "font-medium",
                    )}
                  >
                    <dt className={isToday ? undefined : "text-muted"}>{dayName(d)}</dt>
                    <dd className={cn("text-right", !open && "text-muted")}>
                      {open ? row!.intervals.map((i) => `${i.opensAt}–${i.closesAt}`).join(", ") : t("closed")}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </section>
    </StorefrontChrome>
  );
}

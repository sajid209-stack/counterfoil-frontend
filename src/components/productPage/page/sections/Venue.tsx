"use client";

import { useTranslations } from "next-intl";
import { MapPin, Navigation } from "lucide-react";
import { usePage } from "../context";
import { Section } from "../Section";
import { venueOf } from "./helpers";

/**
 * Where: the venue's name and address and a Get directions button, always; and
 * beside them (below on a phone) a REAL Google map, embedded lazily so it costs
 * nothing until it scrolls near. A preview draws no map at all — nothing in the
 * designer should reach out to a third party — and the card is laid out to look
 * complete without one.
 */
export function VenueSection() {
  const ctx = usePage();
  const t = useTranslations("storefront");
  const venue = venueOf(ctx);
  if (!venue.name) return null;
  const phone = ctx.layout === "phone";
  const map = !ctx.inert;
  const embed = `https://www.google.com/maps?q=${encodeURIComponent([venue.name, venue.address].filter(Boolean).join(", "))}&output=embed`;

  const directions = (
    <>
      <Navigation size={18} strokeWidth={ctx.style.stroke} aria-hidden />
      {t("pg.sec.getDirections")}
    </>
  );

  const text = (
    <div className={map ? "flex min-w-0 flex-col" : "flex min-w-0 flex-1 items-start gap-4"}>
      {!map && (
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--pg-soft)", color: "var(--pg-ink)" }}
        >
          <MapPin size={22} strokeWidth={ctx.style.stroke} />
        </span>
      )}
      <div className="min-w-0">
        <h3 className="text-[16px] font-semibold leading-6" style={{ overflowWrap: "anywhere" }}>
          {venue.name}
        </h3>
        {venue.address && (
          <p className="pg-body pg-muted mt-1" style={{ overflowWrap: "anywhere" }}>
            {venue.address}
          </p>
        )}
        {map && (
          <div className="mt-6">
            <a href={venue.href} target="_blank" rel="noreferrer noopener" className="pg-btn-secondary w-fit">
              {directions}
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Section id="venue" title={ctx.labels.venue}>
      {map ? (
        <div className="pg-card grid gap-6 overflow-hidden p-5 md:p-6" style={{ gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1.2fr)" }}>
          {text}
          <div className="pg-media relative overflow-hidden" style={{ aspectRatio: phone ? "16 / 10" : undefined, minHeight: phone ? undefined : 240, background: "var(--pg-surface)", border: "1px solid var(--pg-line)" }}>
            <iframe
              src={embed}
              title={t("pg.sec.mapTitle", { name: venue.name })}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 size-full border-0"
            />
          </div>
        </div>
      ) : (
        <div className="pg-card flex flex-wrap items-center justify-between gap-x-6 gap-y-5 p-5 md:p-6">
          {text}
          <span className="pg-btn-secondary w-fit" aria-disabled="true" style={{ cursor: "default" }}>
            {directions}
          </span>
        </div>
      )}
    </Section>
  );
}

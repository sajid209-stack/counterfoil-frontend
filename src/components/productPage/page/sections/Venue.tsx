"use client";

import { useTranslations } from "next-intl";
import { Navigation } from "lucide-react";
import { usePage } from "../context";
import { Section } from "../Section";
import { venueOf } from "./helpers";

/**
 * Where: the venue's name and address, the "when" in words, a Get directions
 * link and a calm drawn map. The map says nothing it cannot know — a grid and a
 * pin, no street labels.
 */
export function VenueSection() {
  const ctx = usePage();
  const t = useTranslations("storefront");
  const venue = venueOf(ctx);
  if (!venue.name) return null;
  const stacked = ctx.layout === "phone";

  const directions = (
    <>
      <Navigation size={18} strokeWidth={2} aria-hidden />
      {t("pg.sec.getDirections")}
    </>
  );

  return (
    <Section id="venue" title={ctx.labels.venue}>
      <div
        className="pg-card grid gap-6 overflow-hidden p-5 md:p-6"
        style={{ gridTemplateColumns: stacked ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)" }}
      >
        <div className="flex min-w-0 flex-col">
          <h3 className="text-[20px] font-semibold leading-7" style={{ overflowWrap: "anywhere" }}>
            {venue.name}
          </h3>
          {venue.address && (
            <p className="pg-body pg-muted mt-1" style={{ overflowWrap: "anywhere" }}>
              {venue.address}
            </p>
          )}
          <div className="mt-6">
            {ctx.inert ? (
              <span className="pg-btn-secondary w-fit" aria-disabled="true" style={{ cursor: "default" }}>
                {directions}
              </span>
            ) : (
              <a href={venue.href} target="_blank" rel="noreferrer noopener" className="pg-btn-secondary w-fit">
                {directions}
              </a>
            )}
          </div>
        </div>
        <MapPanel stacked={stacked} />
      </div>
    </Section>
  );
}

/** A drawn, label-free map: a few streets, a block or two and a pin. */
function MapPanel({ stacked }: { stacked: boolean }) {
  return (
    <div
      aria-hidden
      className="relative min-h-[180px] overflow-hidden rounded-xl"
      style={{ background: "var(--pg-surface)", border: "1px solid var(--pg-line)", aspectRatio: stacked ? "16 / 10" : undefined }}
    >
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {/* blocks */}
        <rect x="26" y="22" width="78" height="46" rx="6" fill="var(--pg-card)" />
        <rect x="124" y="22" width="74" height="46" rx="6" fill="var(--pg-card)" />
        <rect x="26" y="88" width="78" height="38" rx="6" fill="var(--pg-card)" />
        <rect x="214" y="22" width="80" height="104" rx="6" fill="var(--pg-card)" />
        <rect x="26" y="146" width="172" height="34" rx="6" fill="var(--pg-card)" />
        <rect x="214" y="146" width="80" height="34" rx="6" fill="var(--pg-card)" />
        {/* streets */}
        <g stroke="var(--pg-line)" strokeWidth="8" strokeLinecap="round">
          <line x1="0" y1="78" x2="320" y2="78" />
          <line x1="0" y1="136" x2="320" y2="136" />
          <line x1="112" y1="0" x2="112" y2="200" />
          <line x1="204" y1="0" x2="204" y2="200" />
        </g>
        <g stroke="var(--pg-line)" strokeWidth="4" strokeLinecap="round">
          <line x1="0" y1="14" x2="320" y2="14" />
          <line x1="300" y1="0" x2="300" y2="200" />
          <line x1="16" y1="0" x2="16" y2="200" />
        </g>
        {/* pin */}
        <g transform="translate(158 108)">
          <ellipse cx="0" cy="26" rx="9" ry="3" fill="var(--pg-line)" />
          <path d="M0 24 C-14 6 -18 -2 -18 -12 a18 18 0 0 1 36 0 c0 10 -4 18 -18 36z" fill="var(--pg-fill)" />
          <circle cx="0" cy="-12" r="6.5" fill="var(--pg-on-fill)" />
        </g>
      </svg>
    </div>
  );
}

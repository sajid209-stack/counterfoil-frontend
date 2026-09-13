"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { ArrowRight, Building2, CalendarDays, ChevronDown, Clock, Flame, Lightbulb, MapPin, Play, Rocket, Ticket, Users } from "lucide-react";
import type { EventRecord } from "@/lib/api/events";
import { eventFromPrice } from "@/lib/api/events";
import { categoryById, type EventTheme, type SectionId } from "@/lib/events/catalog";
import { parseEventVideo } from "@/lib/events/video";
import { formatMoney } from "@/lib/format";

/**
 * The published event page — one renderer, six themes.
 *
 * Two rules hold the whole thing together:
 *
 * 1. **A theme is data, not a component.** Every template draws the same
 *    ordered sections from the same record; a theme supplies colours, two
 *    typefaces, a radius and a layout variant. Adding a section here adds it to
 *    all six, styled correctly, rather than to one of six near-identical files.
 *
 * 2. **The colours are a scoped island, never design-system tokens.** Everything
 *    below reads `--e-*` custom properties declared on the root. A published
 *    event page has its own fixed look, so an operator flipping the dashboard to
 *    dark must not repaint a customer's page — and nothing in here can leak out
 *    into the OS chrome around it.
 */

type Device = "desktop" | "tablet" | "mobile";

interface Labels {
  lineup: string;
  schedule: string;
  about: string;
  tickets: string;
  venue: string;
  faq: string;
  gallery: string;
  soldOut: string;
  free: string;
  from: string;
  getTickets: string;
  addToCalendar: string;
  doorsOpen: string;
  countdownDays: string;
  countdownHours: string;
  countdownMins: string;
  highlights: string;
  stats: string;
  orderSummary: string;
  orderHint: string;
  total: string;
  selectTickets: string;
  checkoutTrust: string;
  sellingFast: string;
  almostGone: string;
  soldOutBadge: string;
  video: string;
  watchOn: string;
  playVideo: string;
  sponsors: string;
  hostedBy: string;
  mostPopular: string;
  chooseTicket: string;
  perPerson: string;
  subtotal: string;
  checkout: string;
  viewAllSpeakers: string;
  viewAgenda: string;
  viewOnMap: string;
  /** Carries a "{count}" placeholder the template fills. */
  remaining: string;
}

export function EventTemplate({
  event,
  device = "desktop",
  labels,
  now,
}: {
  event: EventRecord;
  device?: Device;
  labels: Labels;
  /** Passed in rather than read from the clock so the countdown is
   *  deterministic in a preview and cannot hydrate to a different number. */
  now: Date;
}) {
  const cat = categoryById(event.categoryId);
  const t = cat.theme;
  const c = event.customisation;
  const narrow = device === "mobile";
  const variant = c.variant;

  const vars = {
    "--e-bg": t.bg,
    "--e-fg": t.fg,
    "--e-panel": t.panel,
    "--e-line": t.line,
    "--e-muted": t.muted,
    "--e-accent": c.accent,
    "--e-on-accent": onAccent(c.accent, t.onAccent),
    "--e-accent-ink": accentInk(c.accent, t.bg, t.fg),
    /* The same derivation against the panel. Accent text on a card is sitting
       on a different colour from accent text on the page, and a ratio computed
       against the wrong backdrop is not a ratio. */
    "--e-panel-ink": accentInk(c.accent, t.panel, t.fg),
    "--e-badge-bg": mix(c.accent, t.panel, 0.16),
    "--e-badge-ink": accentInk(c.accent, mix(c.accent, t.panel, 0.16), t.fg),
    "--e-badge-muted-bg": mix(t.muted, t.panel, 0.16),
    "--e-display": c.displayFont,
    "--e-body": c.bodyFont,
    "--e-radius": t.radius,
  } as CSSProperties;

  const pad = narrow ? "20px" : "clamp(28px, 5vw, 72px)";
  const upper = t.eyebrowCase === "upper";

  const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <p
      style={{
        font: "500 12px/1.2 var(--e-body)",
        letterSpacing: upper ? "0.16em" : "0.04em",
        textTransform: upper ? "uppercase" : "none",
        color: "var(--e-accent-ink)",
        margin: 0,
      }}
    >
      {children}
    </p>
  );

  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h2
      style={{
        font: `600 ${narrow ? "24px" : "34px"}/1.1 var(--e-display)`,
        letterSpacing: t.displayTracking,
        color: "var(--e-fg)",
        margin: "10px 0 0",
      }}
    >
      {children}
    </h2>
  );

  const Section = ({
    id,
    index,
    eyebrow,
    title,
    children,
  }: {
    id: string;
    index: number;
    eyebrow: string;
    title: string;
    children: React.ReactNode;
  }) => (
    <section
      id={id}
      style={{
        // The sticky bar is ~56px tall, so an anchor that lands flush puts the
        // heading underneath it. Offset the scroll, not the layout.
        scrollMarginTop: narrow ? 60 : 68,
        padding: `${narrow ? "40px" : "72px"} ${pad}`,
        borderTop: `1px solid var(--e-line)`,
      }}
    >
      {/* The eyebrow only earns its place when it says something the heading
          does not — "About" over the subtitle, "Venue" over the venue's name.
          Where they would be the same word (Lineup over Lineup, Tickets over
          Tickets) it is replaced by a short accent rule: the rhythm survives
          and the page stops repeating itself down its whole length. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        {/* The index is real information, not decoration: the page is an
            ordered run of sections and the operator chose that order. */}
        <span
          aria-hidden
          style={{
            font: "600 12px/1 var(--e-body)",
            letterSpacing: "0.14em",
            color: "var(--e-accent-ink)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(index).padStart(2, "0")}
        </span>
        <span aria-hidden style={{ height: 1, flex: 1, background: "var(--e-line)", maxWidth: 64 }} />
        {eyebrow.toLowerCase() !== title.toLowerCase() && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      <Heading>{title}</Heading>
      <div style={{ marginTop: narrow ? 20 : 32 }}>{children}</div>
    </section>
  );

  const start = new Date(event.startsAt);
  const fromPrice = eventFromPrice(event);
  /* The business template's own layout. It is a VARIANT rather than a category
     check because an operator can switch business to `stacked`, and a fact
     strip built for a three-column conference header has no business surviving
     that choice. */
  const structured = variant === "structured";
  /* The dark, full-bleed layouts draw the figures as panels rather than as one
     tinted band — see the stats renderer for why. */
  const carded = variant === "floodlit";

  /* The bill is the people on it. The agenda is everything that happens,
     breaks included — so the two sections read the same array through
     different filters rather than the seed keeping two copies in step. */
  const billed = event.lineup.filter((l) => l.kind !== "session");

  /* What the venue plate draws, decided by what is actually on the page: an
     event that moves gets a route, a bill of fixtures gets a pitch, everything
     else gets a street map. Derived from the content rather than the category,
     so a yoga class in the sports catalogue does not get a football pitch. */
  const venueShape: "map" | "route" | "pitch" =
    event.categoryId === "travel"
      ? "route"
      : event.lineup.some((l) => /\s+(?:vs\.?|v\.?|versus)\s+/i.test(l.name))
        ? "pitch"
        : "map";

  /* Two rows on this layout are pairs.
     Tickets beside About is the single biggest idea in the brief: the decision
     and the reason to make it sit in one screen instead of the reason being at
     the top and the decision two thousand pixels down. Watch beside Venue is
     the same trade in reverse — neither deserves a full section of its own, and
     together they cost one row instead of two.
     The pair is anchored on the FIRST of the two, and the second draws nothing
     wherever it sits in the order; hide either half and the other takes the
     whole width, so both stay honest controls in the architect. */
  const PAIRS: Partial<Record<SectionId, SectionId>> = structured
    ? { about: "tickets", video: "venue" }
    : {};
  const absorbed = new Set(Object.values(PAIRS).filter(Boolean) as SectionId[]);

  /* Numbered by their place among the sections that ACTUALLY carry a header.
     Counting hero and countdown made the first visible index read "03", with
     01 and 02 nowhere on the page — a numbering that invites the reader to
     look for something that was never drawn. Hiding a section still renumbers
     the rest rather than leaving a gap. */
  const NUMBERED: SectionId[] = c.sections.filter(
    (x) => x !== "hero" && x !== "countdown" && !absorbed.has(x),
  );
  const indexOf = (id: SectionId) => NUMBERED.indexOf(id) + 1;

  /* A section that renders nothing must not appear in the nav: an anchor that
     scrolls nowhere is worse than one fewer link. This mirrors the guards in
     the renderers below rather than guessing from the order alone. */
  const drawn: Partial<Record<SectionId, boolean>> = {
    stats: event.stats.length > 0,
    video: parseEventVideo(event.videoUrl) !== null || (structured && !!event.venueName),
    sponsors: event.sponsors.length > 0,
    highlights: event.highlights.length > 0,
    about: Boolean(event.description) || event.info.length > 0 || event.highlights.length > 0,
    lineup: event.lineup.some((l) => l.kind !== "session"),
    schedule: event.lineup.length > 0,
    gallery: true,
    tickets: true,
    venue: true,
    faq: event.faq.length > 0,
  };
  const anchorLabel: Partial<Record<SectionId, string>> = {
    stats: labels.stats,
    video: labels.video,
    sponsors: labels.sponsors,
    highlights: labels.highlights,
    about: labels.about,
    lineup: labels.lineup,
    schedule: labels.schedule,
    gallery: labels.gallery,
    tickets: labels.tickets,
    venue: labels.venue,
    faq: labels.faq,
  };
  /* Five at most. A nav that wraps to a second line stops being chrome and
     starts being a section of its own. */
  const anchors = c.sections
    .filter(
      (x) =>
        x !== "hero" &&
        x !== "countdown" &&
        // The bar already ends in a Get-tickets pill, so an anchor beside it
        // saying Tickets is the same destination twice in 200px.
        x !== "tickets" &&
        drawn[x] &&
        anchorLabel[x],
    )
    .slice(0, 5);

  /* Scarcity is stated only when it is true. Summed across the whole event
     rather than read off one tier: a sold-out VIP box beside four thousand
     unsold standing tickets is not an event selling fast. */
  const stock = event.tiers.reduce(
    (a, x) => ({ q: a.q + x.quantity, sold: a.sold + x.sold }),
    { q: 0, sold: 0 },
  );
  const sellingFast = stock.q > 0 && stock.sold / stock.q >= 0.5;


  const draw: Record<SectionId, () => React.ReactNode> = {
    hero: () => (
      <Hero event={event} variant={variant} narrow={narrow} theme={t} labels={labels} pad={pad} upper={upper} fromPrice={fromPrice} />
    ),
    countdown: () => (
      <Countdown to={start} now={now} narrow={narrow} pad={pad} labels={labels} upper={upper} glow={t.glow} />
    ),
    /* Three figures, stated before anyone scrolls. What they SAY differs by
       category — a gallery counts works and weeks, a tour counts days and
       stops — because "at a glance" is only useful if it is a glance at the
       thing in front of you. */
    stats: () =>
      event.stats.length ? (
        <div
          id="stats"
          style={
            carded
              ? { padding: `0 ${pad}`, scrollMarginTop: narrow ? 60 : 68 }
              : {
                  borderTop: `1px solid var(--e-line)`,
                  borderBottom: `1px solid var(--e-line)`,
                  background: "var(--e-panel)",
                  scrollMarginTop: narrow ? 60 : 68,
                }
          }
        >
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              padding: carded ? (narrow ? "26px 0" : "40px 0") : narrow ? "22px 20px" : "34px 48px",
              display: "grid",
              gridTemplateColumns: narrow
                ? "repeat(2, 1fr)"
                : `repeat(${Math.min(event.stats.length, 4)}, 1fr)`,
              gap: carded ? (narrow ? 10 : 16) : narrow ? 18 : 0,
            }}
          >
            {event.stats.map((st, i) => (
              <div
                key={st.id}
                style={{
                  textAlign: "center",
                  /* A rule between the figures rather than a gap: four numbers
                     spaced apart read as four unrelated facts, and the strip's
                     whole job is to be read as one claim.

                     On a near-black ground that strip is invisible — a tinted
                     band only separates itself from a light page — so the dark
                     templates give each figure its own panel instead. */
                  ...(carded
                    ? {
                        borderRadius: "var(--e-radius)",
                        border: `1px solid var(--e-line)`,
                        background: "var(--e-panel)",
                        padding: narrow ? "18px 12px" : "24px 18px",
                      }
                    : {
                        borderLeft: !narrow && i ? `1px solid var(--e-line)` : undefined,
                        padding: narrow ? 0 : "0 20px",
                      }),
                }}
              >
                <p
                  style={{
                    font: `700 ${narrow ? "28px" : "40px"}/1 var(--e-display)`,
                    letterSpacing: t.displayTracking,
                    color: "var(--e-accent-ink)",
                    margin: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {st.value}
                </p>
                <p style={{ font: `400 ${narrow ? "13px" : "14px"}/1.4 var(--e-body)`, color: "var(--e-muted)", margin: "8px 0 0" }}>
                  {st.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null,

    /* Teaser chips. Deliberately not links: they are an appetiser for the
       sections below, and a chip that navigates nowhere is honest where one
       that scrolls somewhere arbitrary is not. */
    highlights: () =>
      event.highlights.length ? (
        <Section id="highlights" index={indexOf("highlights")} eyebrow={labels.highlights} title={labels.highlights}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: narrow ? 18 : 30 }}>
            {event.highlights.map((h, i) => (
              <div key={h.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: narrow ? 70 : 84 }}>
                <span
                  aria-hidden
                  style={{
                    width: narrow ? 52 : 64,
                    height: narrow ? 52 : 64,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    border: `1.5px solid var(--e-accent)`,
                    background: artFor(c.accent, i, isLight(t.bg)),
                    font: `600 ${narrow ? "15px" : "18px"}/1 var(--e-display)`,
                    color: "var(--e-accent-ink)",
                  }}
                >
                  {h.label.trim().charAt(0).toUpperCase()}
                </span>
                <span
                  style={{
                    font: `500 ${narrow ? "12px" : "12px"}/1.3 var(--e-body)`,
                    color: "var(--e-muted)",
                    textAlign: "center",
                    textTransform: upper ? "uppercase" : "none",
                    letterSpacing: upper ? "0.06em" : 0,
                  }}
                >
                  {h.label}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null,

    /* A conference is sold on what last year looked like, which is why every
       reference page for one leads with footage. Click-to-load rather than a
       bare iframe: nothing is requested from a third party until a visitor
       asks for it, the page does not carry an embed's weight for the many
       people who never press play, and there is no layout jump when it lands. */
    /* Watch, with the venue card beside it.
       Neither earns a full-width section: a trailer is a thirty-second look and
       a venue is an address and a plan of how to get there. Side by side they
       cost one row instead of two, which is most of the scrolling this page
       used to ask for between the speakers and the agenda. */
    video: () => {
      const v = parseEventVideo(event.videoUrl);
      const withVenue = PAIRS.video === "venue";
      if (!v && !withVenue) return null;
      const venueCard = withVenue ? (
        <div
          id="venue"
          style={{
            scrollMarginTop: narrow ? 60 : 68,
            borderRadius: "var(--e-radius)",
            border: `1px solid var(--e-line)`,
            background: "var(--e-panel)",
            padding: narrow ? "18px" : "22px 24px",
            display: "grid",
            gap: narrow ? 14 : 18,
            alignContent: "start",
          }}
        >
          <div>
            <p
              style={{
                font: "600 12px/1 var(--e-body)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--e-muted)",
                margin: 0,
              }}
            >
              {labels.venue}
            </p>
            <p style={{ font: `600 ${narrow ? "18px" : "21px"}/1.25 var(--e-display)`, letterSpacing: t.displayTracking, color: "var(--e-fg)", margin: "10px 0 0" }}>
              {event.venueName}
            </p>
            {event.venueAddress && (
              <p style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "400 14px/1.55 var(--e-body)", color: "var(--e-muted)", margin: "10px 0 0" }}>
                <MapPin size={15} strokeWidth={1.75} style={{ color: "var(--e-accent)", flexShrink: 0, marginTop: 2 }} aria-hidden />
                {event.venueAddress}
              </p>
            )}
            {/* A real link, to a real search. The plate below is a placeholder
                for a map; this is the thing a visitor actually presses. */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [event.venueName, event.venueAddress].filter(Boolean).join(", "),
              )}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                marginTop: 14,
                font: "600 14px/1 var(--e-body)",
                color: "var(--e-accent-ink)",
                textDecoration: "none",
              }}
            >
              {labels.viewOnMap}
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </a>
          </div>
          {/* The practical trio lives here on this layout: doors, what is
              included, how to get there — all of them answers about the day
              itself, beside the address they apply to. */}
          {event.info.length > 0 && (
            <div style={{ display: "grid", gap: 0, borderTop: `1px solid var(--e-line)` }}>
              {event.info.map((f, i) => (
                <div key={f.id} style={{ paddingTop: 12, paddingBottom: i === event.info.length - 1 ? 0 : 12, borderTop: i ? `1px solid var(--e-line)` : "none" }}>
                  <p
                    style={{
                      font: "600 12px/1 var(--e-body)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--e-panel-ink)",
                      margin: 0,
                    }}
                  >
                    {f.label}
                  </p>
                  <p style={{ font: "400 14px/1.5 var(--e-body)", color: "var(--e-muted)", margin: "6px 0 0" }}>{f.value}</p>
                </div>
              ))}
            </div>
          )}
          <VenueMap narrow={narrow} shape={venueShape} />
        </div>
      ) : null;

      return (
        <Section id="video" index={indexOf("video")} eyebrow={labels.video} title={labels.video}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: narrow || !v || !venueCard ? "1fr" : "minmax(0, 1.35fr) minmax(300px, 1fr)",
              gap: narrow ? 20 : 28,
              alignItems: "start",
            }}
          >
            {v && (
              <div>
                <VideoPlayer video={v} accent={c.accent} light={isLight(t.bg)} labels={labels} narrow={narrow} />
                <a
                  href={v.watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    marginTop: 14,
                    font: "600 14px/1 var(--e-body)",
                    color: "var(--e-accent-ink)",
                    textDecoration: "none",
                  }}
                >
                  {labels.watchOn}
                  <ArrowRight size={14} strokeWidth={2} aria-hidden />
                </a>
              </div>
            )}
            {venueCard}
          </div>
        </Section>
      );
    },

    sponsors: () =>
      event.sponsors.length ? (
        <Section id="sponsors" index={indexOf("sponsors")} eyebrow={labels.sponsors} title={labels.sponsors}>
          <SponsorWall sponsors={event.sponsors} narrow={narrow} theme={t} upper={upper} />
        </Section>
      ) : null,

    /* About, with the ticket panel beside it.
       The reason to come and the way to come are one decision, so they are one
       row: the left column argues and the right column takes the money. On a
       phone the argument comes first and the panel follows, because a buyer
       scrolling a 390px screen has not been given the reason yet. */
    about: () => {
      const hasAbout = Boolean(event.description) || event.highlights.length > 0 || Boolean(event.organiser);
      const rail = PAIRS.about === "tickets" && (drawn.tickets ?? false);
      if (!hasAbout && !rail) return null;
      const body = (
        <>
          {event.description && (
            <p
              style={{
                font: `400 ${narrow ? "15px" : "17px"}/1.7 var(--e-body)`,
                color: "var(--e-muted)",
                maxWidth: "56ch",
                margin: 0,
              }}
            >
              {event.description}
            </p>
          )}
          {/* Three things the visitor gets, each with its own line.
              The glyph is keyed to position rather than to meaning — nothing in
              the record says what a benefit is ABOUT — so it is a consistent
              motif down the page rather than an icon pretending to classify. */}
          {structured && event.highlights.length > 0 && (
            <div
              style={{
                marginTop: event.description ? (narrow ? 24 : 34) : 0,
                display: "grid",
                gridTemplateColumns: narrow ? "1fr" : `repeat(${Math.min(event.highlights.length, 3)}, minmax(0, 1fr))`,
                gap: narrow ? 20 : 26,
              }}
            >
              {event.highlights.slice(0, 3).map((h, i) => {
                const Glyph = [Lightbulb, Users, Rocket][i % 3];
                return (
                  <div key={h.id} style={{ minWidth: 0 }}>
                    <span
                      aria-hidden
                      style={{
                        display: "grid",
                        placeItems: "center",
                        width: 44,
                        height: 44,
                        borderRadius: "var(--e-radius)",
                        background: `color-mix(in srgb, var(--e-accent) 12%, transparent)`,
                      }}
                    >
                      <Glyph size={20} strokeWidth={1.75} style={{ color: "var(--e-accent)" }} />
                    </span>
                    <p style={{ font: `600 ${narrow ? "15px" : "16px"}/1.35 var(--e-body)`, color: "var(--e-fg)", margin: "16px 0 0" }}>
                      {h.label}
                    </p>
                    {h.description && (
                      <p style={{ font: "400 14px/1.6 var(--e-body)", color: "var(--e-muted)", margin: "8px 0 0" }}>
                        {h.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {event.organiser && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: narrow ? 12 : 16,
                marginTop: narrow ? 24 : 32,
                padding: narrow ? "14px 16px" : "16px 20px",
                borderRadius: "var(--e-radius)",
                border: `1px solid var(--e-line)`,
                background: "var(--e-panel)",
                maxWidth: "56ch",
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: narrow ? 40 : 46,
                  height: narrow ? 40 : 46,
                  borderRadius: 999,
                  background: `color-mix(in srgb, var(--e-accent) 14%, transparent)`,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Building2 size={narrow ? 18 : 20} strokeWidth={1.75} style={{ color: "var(--e-accent)" }} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    font: "600 12px/1 var(--e-body)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--e-panel-ink)",
                    margin: 0,
                  }}
                >
                  {labels.hostedBy}
                </p>
                <p style={{ font: `600 ${narrow ? "15px" : "16px"}/1.3 var(--e-body)`, color: "var(--e-fg)", margin: "7px 0 0" }}>
                  {event.organiser.name}
                </p>
                {event.organiser.blurb && (
                  <p style={{ font: "400 13px/1.55 var(--e-body)", color: "var(--e-muted)", margin: "5px 0 0" }}>
                    {event.organiser.blurb}
                  </p>
                )}
              </div>
            </div>
          )}
          {/* The practical trio. On the paired layout it travels with the
              venue card, where "doors at 08:30" sits with the address it
              applies to; elsewhere it belongs here with the prose. */}
          {!structured && event.info.length > 0 && (
            <div
              style={{
                marginTop: narrow ? 22 : 30,
                display: "grid",
                gridTemplateColumns: narrow ? "1fr" : `repeat(${Math.min(event.info.length, 3)}, 1fr)`,
                gap: narrow ? 10 : 16,
              }}
            >
              {event.info.map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: narrow ? "14px 16px" : "18px 20px",
                    borderRadius: "var(--e-radius)",
                    border: `1px solid var(--e-line)`,
                    background: "var(--e-panel)",
                  }}
                >
                  <p
                    style={{
                      font: "600 12px/1 var(--e-body)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--e-panel-ink)",
                      margin: 0,
                    }}
                  >
                    {f.label}
                  </p>
                  <p style={{ font: "400 14px/1.55 var(--e-body)", color: "var(--e-muted)", margin: "9px 0 0" }}>{f.value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      );

      if (!rail) {
        return (
          <Section id="about" index={indexOf("about")} eyebrow={labels.about} title={structured ? labels.about : event.subtitle || labels.about}>
            {body}
          </Section>
        );
      }
      return (
        <Section id="about" index={indexOf("about")} eyebrow={labels.about} title={structured ? labels.about : event.subtitle || labels.about}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: narrow ? "1fr" : "minmax(0, 1.55fr) minmax(320px, 0.95fr)",
              gap: narrow ? 28 : 44,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>{hasAbout ? body : null}</div>
            <TicketPanel event={event} narrow={narrow} labels={labels} theme={t} />
          </div>
        </Section>
      );
    },
    lineup: () =>
      billed.length ? (
        <Section id="lineup" index={indexOf("lineup")} eyebrow={labels.lineup} title={labels.lineup}>
          {/* People and works get cards; a sequence gets rows.
              That is a distinction in the CONTENT, not a style preference: a
              headliner, a speaker and a painting are each a thing you look at
              and want a face for, while fixtures and an itinerary are read in
              order down a column and a grid of them destroys the order. */}
          {PORTRAIT_BILL.has(cat.lineupKey) ? (
            <LineupCards
              entries={billed}
              narrow={narrow}
              variant={variant}
              theme={t}
              accent={c.accent}
              labels={labels}
              /* Four to start on this layout. A conference bills two dozen
                 speakers and a wall of two dozen portraits is a wall, not a
                 line-up — the four the operator listed first are the four they
                 are selling on. The rest open in place rather than behind a
                 link, because there is no speakers page for a link to go to. */
              featured={structured ? 4 : undefined}
            />
          ) : (
            /* Fixtures are a running order as well as a bill, so they get the
               same day tabs the agenda has: a three-day tournament read as one
               column of twenty-four rows is the thing tabs exist to prevent.
               With one day it falls through to a plain list. */
            <Agenda entries={billed} narrow={narrow} labels={labels} upper={upper} />
          )}
        </Section>
      ) : null,
    schedule: () =>
      event.lineup.length ? (
        <Section id="schedule" index={indexOf("schedule")} eyebrow={labels.schedule} title={labels.schedule}>
          {/* Day tabs appear only where the data has days. A conference runs
              over three of them and its agenda is unreadable as one column of
              forty rows; a single evening has one day and a tab strip with one
              tab in it is a control that decides nothing. */}
          <Agenda entries={event.lineup} narrow={narrow} labels={labels} upper={upper} />
        </Section>
      ) : null,
    gallery: () => (
      <Section id="gallery" index={indexOf("gallery")} eyebrow={labels.gallery} title={labels.gallery}>
        {/* A mosaic, not a contact sheet. Equal squares read as a filing
            system; varied spans read as a set of photographs somebody chose.
            The spans are declared so both rows fill exactly — a grid that
            leaves a hole is the thing that makes a gallery look broken. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: narrow ? "repeat(2, 1fr)" : "repeat(6, 1fr)",
            gridAutoRows: narrow ? "88px" : "clamp(96px, 11vw, 158px)",
            gap: narrow ? 8 : 14,
          }}
        >
          {(narrow
            ? [
                { c: 2, r: 2 },
                { c: 1, r: 1 },
                { c: 1, r: 1 },
                { c: 2, r: 1 },
              ]
            : [
                { c: 3, r: 2 },
                { c: 3, r: 1 },
                { c: 2, r: 1 },
                { c: 1, r: 1 },
              ]
          ).map((tile, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                gridColumn: `span ${tile.c}`,
                gridRow: `span ${tile.r}`,
                borderRadius: "var(--e-radius)",
                background: plateArt(c.accent, i, isLight(t.bg)),
                border: `1px solid var(--e-line)`,
              }}
            />
          ))}
        </div>
      </Section>
    ),
    tickets: () =>
      absorbed.has("tickets") ? null : (
        <Section id="tickets" index={indexOf("tickets")} eyebrow={labels.tickets} title={labels.tickets}>
          <TicketTable event={event} narrow={narrow} labels={labels} theme={t} />
        </Section>
      ),
    venue: () =>
      absorbed.has("venue") ? null : (
      <Section id="venue" index={indexOf("venue")} eyebrow={labels.venue} title={event.venueName}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", alignItems: "start" }}>
          <div>
            {event.venueAddress && (
              <p style={{ font: "400 15px/1.6 var(--e-body)", color: "var(--e-muted)", margin: 0 }}>
                {event.venueAddress}
              </p>
            )}
            <p style={{ font: "400 15px/1.6 var(--e-body)", color: "var(--e-muted)", margin: "10px 0 0" }}>
              {longDate(start)} · {time(start)}
            </p>
          </div>
          {/* A map stands in as a themed plate rather than an embedded tile: a
              broken third-party map is worse than an honest placeholder, and
              the address above is what someone actually copies. */}
          <VenueMap narrow={narrow} shape={venueShape} />
        </div>
      </Section>
    ),
    faq: () =>
      event.faq.length ? (
        <Section id="faq" index={indexOf("faq")} eyebrow={labels.faq} title={labels.faq}>
          {/* <details> rather than a state hook: it opens with no JavaScript,
              it is keyboard- and screen-reader-correct for free, and the page
              is printed and crawled as often as it is clicked. */}
          <div style={{ display: "grid", gap: 10, maxWidth: "72ch" }}>
            {event.faq.map((f) => (
              <details
                key={f.id}
                style={{
                  borderRadius: "var(--e-radius)",
                  border: `1px solid var(--e-line)`,
                  background: "var(--e-panel)",
                  padding: narrow ? "13px 15px" : "15px 18px",
                }}
              >
                <summary
                  style={{
                    font: `600 ${narrow ? "14px" : "15px"}/1.45 var(--e-body)`,
                    color: "var(--e-fg)",
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                  }}
                >
                  {f.q}
                  <ChevronDown size={16} strokeWidth={1.75} style={{ color: "var(--e-muted)", flexShrink: 0 }} aria-hidden />
                </summary>
                <p style={{ font: "400 14px/1.65 var(--e-body)", color: "var(--e-muted)", margin: "10px 0 0" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      ) : null,
  };

  return (
    <div
      style={{
        ...vars,
        background: "var(--e-bg)",
        color: "var(--e-fg)",
        fontFamily: "var(--e-body)",
        // Contains the theme entirely: nothing inside inherits an OS token and
        // nothing here escapes into the shell around the preview.
        isolation: "isolate",
        position: "relative",
      }}
    >
      {t.glow && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "radial-gradient(circle at 18% 8%, color-mix(in srgb, var(--e-accent) 24%, transparent), transparent 42%), radial-gradient(circle at 88% 4%, color-mix(in srgb, var(--e-accent) 14%, transparent), transparent 38%)",
          }}
        />
      )}
      {/* Grain. Flat colour reads as flat colour, and a little noise is most of
          the difference between a coloured rectangle and a surface somebody
          designed. Heavier on the dark themes, where it reads as film; barely
          there on the light ones, where it would only look like dirt. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2,
          opacity: isLight(t.bg) ? 0.035 : 0.07,
          mixBlendMode: "overlay",
          backgroundImage: GRAIN,
        }}
      />
      <div style={{ position: "relative" }}>
        {/* The chrome a ticket page is recognised by: the event's own name, its
            sections as anchors, and the one action the page exists for pinned
            to the right of both. Sticky rather than fixed — fixed escapes the
            scaled preview frame and lands on the wizard's own chrome. */}
        <nav
          aria-label={event.title}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 3,
            display: "flex",
            alignItems: "center",
            gap: narrow ? 10 : 20,
            padding: `${narrow ? 9 : 11}px ${pad}`,
            background: `color-mix(in srgb, var(--e-bg) 86%, transparent)`,
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid var(--e-line)`,
          }}
        >
          <span
            style={{
              font: `600 ${narrow ? "13px" : "15px"}/1.2 var(--e-display)`,
              letterSpacing: t.displayTracking,
              textTransform: upper ? "uppercase" : "none",
              color: "var(--e-fg)",
              minWidth: 0,
              maxWidth: narrow ? "50%" : 280,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </span>
          {!narrow && anchors.length > 0 && (
            <div style={{ display: "flex", gap: 24, marginLeft: "auto", minWidth: 0 }}>
              {anchors.map((a) => (
                <a
                  key={a}
                  href={`#${a}`}
                  style={{
                    font: "500 13px/1 var(--e-body)",
                    letterSpacing: upper ? "0.1em" : "0.02em",
                    textTransform: upper ? "uppercase" : "none",
                    color: "var(--e-muted)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {anchorLabel[a]}
                </a>
              ))}
            </div>
          )}
          <a
            href="#tickets"
            style={{
              marginLeft: narrow || anchors.length === 0 ? "auto" : 0,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: narrow ? "8px 14px" : "9px 18px",
              borderRadius: 999,
              background: "var(--e-accent)",
              color: "var(--e-on-accent)",
              font: `600 ${narrow ? "12px" : "13px"}/1 var(--e-body)`,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            <Ticket size={narrow ? 13 : 14} strokeWidth={2} />
            {labels.getTickets}
          </a>
        </nav>
        {c.sections.map((s) => (absorbed.has(s) ? null : <div key={s}>{draw[s]?.()}</div>))}

        {/* A sticky bar is what turns a page into a ticket page. It states the
            cheapest ticket still on sale — the figure a buyer scans for — and
            never scrolls away from the reason they are here. */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: `12px ${pad}`,
            background: `color-mix(in srgb, var(--e-bg) 88%, transparent)`,
            backdropFilter: "blur(10px)",
            borderTop: `1px solid var(--e-line)`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ font: "500 12px/1.2 var(--e-body)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--e-muted)", margin: 0 }}>
              {labels.from}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
              <p style={{ font: `600 ${narrow ? "17px" : "20px"}/1.2 var(--e-display)`, color: "var(--e-fg)", margin: 0 }}>
                {fromPrice === null ? labels.soldOut : fromPrice === 0 ? labels.free : formatMoney(fromPrice)}
              </p>
              {/* Only where the ledger says so. A permanent "selling fast" is a
                  claim the page cannot back up, and buyers learn to ignore it. */}
              {sellingFast && fromPrice !== null && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 9px",
                    borderRadius: 999,
                    background: "var(--e-badge-bg)",
                    color: "var(--e-badge-ink)",
                    font: "600 12px/1 var(--e-body)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Flame size={12} strokeWidth={2} />
                  {labels.sellingFast}
                </span>
              )}
            </div>
          </div>
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: narrow ? "11px 18px" : "13px 26px",
              borderRadius: "var(--e-radius)",
              background: "var(--e-accent)",
              color: "var(--e-on-accent)",
              font: "600 15px/1 var(--e-body)",
              boxShadow: t.glow ? "0 0 26px color-mix(in srgb, var(--e-accent) 55%, transparent)" : "none",
            }}
          >
            <Ticket size={16} strokeWidth={2} />
            {labels.getTickets}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Hero, the one section that really differs per theme ─────────────────── */

function Hero({
  event,
  variant,
  narrow,
  theme,
  labels,
  pad,
  upper,
  fromPrice,
}: {
  event: EventRecord;
  variant: string;
  narrow: boolean;
  theme: ReturnType<typeof categoryById>["theme"];
  labels: Labels;
  pad: string;
  upper: boolean;
  fromPrice: number | null;
}) {
  const start = new Date(event.startsAt);
  const cover = event.customisation.coverUrl;
  const art = cover ? undefined : artFor(event.customisation.accent, 0, isLight(theme.bg));

  /* Two facts, each with the detail under it: when, and where. The flat row of
     three icon-and-text pairs said the same things in a line that read as a
     caption; stacked, each is a heading with its particulars beneath, which is
     the shape somebody copies into a calendar. */
  const structuredMeta = (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "auto auto", gap: narrow ? 16 : 44, justifyContent: "start", marginTop: narrow ? 22 : 30 }}>
      {[
        {
          icon: CalendarDays,
          head: longDate(start),
          sub: event.endsAt ? `${time(start)} \u2013 ${time(new Date(event.endsAt))}` : `${time(start)} \u00b7 ${labels.doorsOpen}`,
        },
        { icon: MapPin, head: event.venueName, sub: event.venueAddress },
      ].map(({ icon: Icon, head, sub }) => (
        <div key={head} style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: "var(--e-radius)",
              background: `color-mix(in srgb, var(--e-accent) 12%, transparent)`,
            }}
          >
            <Icon size={17} strokeWidth={1.75} style={{ color: "var(--e-accent)" }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ font: "600 15px/1.35 var(--e-body)", color: "var(--e-fg)", margin: 0 }}>{head}</p>
            {sub && <p style={{ font: "400 14px/1.4 var(--e-body)", color: "var(--e-muted)", margin: "3px 0 0" }}>{sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );

  const meta = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: narrow ? "10px 18px" : "12px 28px", marginTop: narrow ? 18 : 26 }}>
      {[
        { icon: CalendarDays, text: longDate(start) },
        { icon: Clock, text: `${time(start)} \u00b7 ${labels.doorsOpen}` },
        { icon: MapPin, text: event.venueName },
      ].map(({ icon: Icon, text }) => (
        <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Icon size={15} strokeWidth={1.75} style={{ color: "var(--e-accent)", flexShrink: 0 }} />
          <span style={{ font: "400 14px/1.4 var(--e-body)", color: "var(--e-muted)" }}>{text}</span>
        </span>
      ))}
    </div>
  );

  const titleSize = narrow
    ? variant === "poster" || variant === "neon"
      ? "clamp(34px, 12vw, 52px)"
      : "clamp(27px, 8.5vw, 38px)"
    : variant === "poster" || variant === "neon"
      ? "clamp(56px, 8vw, 104px)"
      : variant === "editorial"
        ? "clamp(40px, 5vw, 68px)"
        : "clamp(40px, 5.5vw, 76px)";

  const Title = (
    <h1
      style={{
        font: `${variant === "editorial" ? 400 : 700} ${titleSize}/${variant === "poster" || variant === "neon" ? 0.94 : 1.04} var(--e-display)`,
        letterSpacing: theme.displayTracking,
        textTransform: variant === "poster" || variant === "neon" ? "uppercase" : "none",
        color: "var(--e-fg)",
        margin: 0,
        textWrap: "balance",
        textShadow: theme.glow ? "0 0 34px color-mix(in srgb, var(--e-accent) 40%, transparent)" : undefined,
      }}
    >
      {event.title}
    </h1>
  );

  const eyebrowText = upper ? event.subtype : event.subtype;

  // ── immersive / poster / neon / floodlit: art behind, content over a scrim ─
  if (variant === "immersive" || variant === "poster" || variant === "neon" || variant === "floodlit") {
    return (
      <header style={{ position: "relative", minHeight: narrow ? 420 : 560, display: "flex", alignItems: "flex-end" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: cover ? `url(${cover}) center/cover` : art,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, var(--e-bg) 4%, color-mix(in srgb, var(--e-bg) 70%, transparent) 44%, color-mix(in srgb, var(--e-bg) 14%, transparent))`,
          }}
        />
        {/* A vignette on top of the scrim. The scrim makes the text legible;
            this is what stops a full-bleed hero reading as a flat rectangle
            with words on it. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(120% 90% at 50% 12%, transparent 38%, color-mix(in srgb, var(--e-bg) 55%, transparent) 100%)`,
          }}
        />
        <div style={{ position: "relative", padding: `${narrow ? 28 : 56}px ${pad}`, width: "100%" }}>
          <span
            style={{
              display: "inline-block",
              padding: "5px 12px",
              borderRadius: "var(--e-radius)",
              background: "var(--e-accent)",
              color: "var(--e-on-accent)",
              font: "600 12px/1.2 var(--e-body)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            {eyebrowText}
          </span>
          {Title}
          {event.subtitle && (
            <p
              style={{
                font: `${variant === "floodlit" ? 600 : 400} ${narrow ? (variant === "floodlit" ? "17px" : "15px") : variant === "floodlit" ? "24px" : "19px"}/1.35 ${
                  variant === "floodlit" ? "var(--e-display)" : "var(--e-body)"
                }`,
                letterSpacing: variant === "floodlit" ? theme.displayTracking : undefined,
                textTransform: variant === "floodlit" ? "uppercase" : "none",
                color: variant === "floodlit" ? "var(--e-accent)" : "var(--e-muted)",
                textShadow:
                  variant === "floodlit" && theme.glow
                    ? "0 0 28px color-mix(in srgb, var(--e-accent) 45%, transparent)"
                    : undefined,
                margin: "16px 0 0",
                maxWidth: "48ch",
              }}
            >
              {event.subtitle}
            </p>
          )}
          {meta}
        </div>
      </header>
    );
  }

  // ── kinetic: a skewed accent plate, the title driving off it ─────────────
  if (variant === "kinetic") {
    return (
      <header style={{ position: "relative", overflow: "hidden", padding: `${narrow ? 36 : 72}px ${pad} ${narrow ? 32 : 64}px` }}>
        {/* Two wedges, not one wash. A 12% tint behind the whole hero is not a
            dynamic angle — it is a pink rectangle. The solid bar is the angle;
            the tint behind it gives it depth, and both stay clear of the text
            column so the title never sits on the accent. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: narrow ? "44%" : "38%",
            height: "100%",
            background: `color-mix(in srgb, var(--e-accent) 14%, transparent)`,
            transform: "skewX(-11deg)",
            transformOrigin: "top right",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            right: narrow ? "-14%" : "-4%",
            width: narrow ? "26%" : "17%",
            height: "100%",
            background: "var(--e-accent)",
            transform: "skewX(-11deg)",
            transformOrigin: "top right",
          }}
        />
        <div style={{ position: "relative", maxWidth: narrow ? "100%" : "68%" }}>
          <span
            style={{
              display: "inline-block",
              padding: "5px 12px",
              background: "var(--e-accent)",
              color: "var(--e-on-accent)",
              font: "700 12px/1.2 var(--e-body)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              transform: "skewX(-9deg)",
              marginBottom: 18,
            }}
          >
            <span style={{ display: "inline-block", transform: "skewX(9deg)" }}>{eyebrowText}</span>
          </span>
          {Title}
          {event.subtitle && (
            <p style={{ font: `400 ${narrow ? "15px" : "19px"}/1.5 var(--e-body)`, color: "var(--e-muted)", margin: "14px 0 0", maxWidth: "46ch" }}>
              {event.subtitle}
            </p>
          )}
          {meta}
        </div>
      </header>
    );
  }

  // ── editorial: whitespace, rules, centred serif ──────────────────────────
  if (variant === "editorial") {
    return (
      <header style={{ padding: `${narrow ? 44 : 96}px ${pad}`, textAlign: narrow ? "left" : "center" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <p style={{ font: "400 12px/1.2 var(--e-body)", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--e-accent-ink)", margin: 0 }}>
            {eyebrowText}
          </p>
          <div style={{ height: 1, background: "var(--e-line)", margin: `${narrow ? 20 : 28}px 0` }} />
          {Title}
          {event.subtitle && (
            <p style={{ font: `400 ${narrow ? "16px" : "20px"}/1.6 var(--e-body)`, color: "var(--e-muted)", margin: "18px auto 0", maxWidth: "52ch" }}>
              {event.subtitle}
            </p>
          )}
          <div style={{ height: 1, background: "var(--e-line)", margin: `${narrow ? 24 : 34}px 0 0` }} />
          <div style={{ display: "flex", justifyContent: narrow ? "flex-start" : "center" }}>{meta}</div>
        </div>
      </header>
    );
  }

  // ── structured (business) and stacked (the universal fallback) ───────────
  const stacked = variant === "stacked";

  /* Two calls to action, and nothing else added.
     The strip of labelled facts the previous pass put here is gone: the brief
     asks for a clean header, and venue and doors are already in the meta row
     two lines above it — stating them twice in one screen is the page arguing
     with itself. They travel with the venue card now.

     The second action only appears when there is an agenda to send someone to.
     A button to a section that is switched off is a promise the page cannot
     keep. */
  const agendaOn = variant === "structured" && event.lineup.length > 0;
  const actions = variant !== "structured" ? null : (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: narrow ? 24 : 32 }}>
      <a
        href="#tickets"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: narrow ? "14px 22px" : "15px 28px",
          borderRadius: "var(--e-radius)",
          background: "var(--e-accent)",
          color: "var(--e-on-accent)",
          font: `600 ${narrow ? "14px" : "15px"}/1 var(--e-body)`,
          textDecoration: "none",
        }}
      >
        {fromPrice === null ? labels.soldOut : labels.getTickets}
        <ArrowRight size={16} strokeWidth={2} aria-hidden />
      </a>
      {agendaOn && (
        <a
          href="#schedule"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: narrow ? "14px 22px" : "15px 28px",
            borderRadius: "var(--e-radius)",
            border: `1px solid var(--e-accent)`,
            color: "var(--e-accent-ink)",
            font: `600 ${narrow ? "14px" : "15px"}/1 var(--e-body)`,
            textDecoration: "none",
          }}
        >
          {labels.viewAgenda}
        </a>
      )}
    </div>
  );

  return (
    <header style={{ padding: `${narrow ? 32 : 68}px ${pad}` }}>
      <div style={{ display: "grid", gap: narrow ? 24 : 44, gridTemplateColumns: narrow || stacked ? "1fr" : "1.15fr 1fr", alignItems: "center" }}>
        <div>
          <span
            style={{
              display: "inline-block",
              padding: "5px 12px",
              borderRadius: "var(--e-radius)",
              background: `color-mix(in srgb, var(--e-accent) 12%, transparent)`,
              color: "var(--e-accent)",
              font: "600 12px/1.2 var(--e-body)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            {eyebrowText}
          </span>
          {Title}
          {event.subtitle && (
            <p style={{ font: `400 ${narrow ? "17px" : "22px"}/1.4 var(--e-body)`, color: "var(--e-muted)", margin: "14px 0 0", maxWidth: "34ch" }}>
              {event.subtitle}
            </p>
          )}

          {variant === "structured" ? structuredMeta : meta}
          {actions}
        </div>
        <div
          aria-hidden
          style={{
            aspectRatio: stacked ? "21 / 9" : "4 / 3",
            borderRadius: "var(--e-radius)",
            background: cover ? `url(${cover}) center/cover` : art,
            border: `1px solid var(--e-line)`,
          }}
        />
      </div>
    </header>
  );
}

/* ── Repeating pieces ────────────────────────────────────────────────────── */

function Countdown({
  to,
  now,
  narrow,
  pad,
  labels,
  upper,
  glow,
}: {
  to: Date;
  now: Date;
  narrow: boolean;
  pad: string;
  labels: Labels;
  upper: boolean;
  glow: boolean;
}) {
  const ms = Math.max(0, to.getTime() - now.getTime());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const cells = [
    { v: days, l: labels.countdownDays },
    { v: hours, l: labels.countdownHours },
    { v: mins, l: labels.countdownMins },
  ];
  return (
    <section
      style={{
        display: "flex",
        gap: narrow ? 10 : 18,
        padding: `${narrow ? 20 : 26}px ${pad}`,
        borderTop: `1px solid var(--e-line)`,
        background: "var(--e-panel)",
      }}
    >
      {cells.map((c) => (
        <div key={c.l} style={{ flex: 1, textAlign: "center" }}>
          <p
            style={{
              font: `700 ${narrow ? "26px" : "38px"}/1 var(--e-display)`,
              /* A theme that glows counts down in its own colour: the figure is
                 the loudest thing in the section, and on a near-black page
                 white is the one colour that says nothing about the event.
                 Large display type, so the 3:1 floor applies and every accent
                 in the catalogue clears it at this size. */
              color: glow ? "var(--e-accent)" : "var(--e-fg)",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
              textShadow: glow ? "0 0 22px color-mix(in srgb, var(--e-accent) 45%, transparent)" : undefined,
            }}
          >
            {String(c.v).padStart(2, "0")}
          </p>
          <p
            style={{
              font: "500 12px/1.2 var(--e-body)",
              letterSpacing: upper ? "0.16em" : "0.06em",
              textTransform: upper ? "uppercase" : "none",
              color: "var(--e-muted)",
              margin: "6px 0 0",
            }}
          >
            {c.l}
          </p>
        </div>
      ))}
    </section>
  );
}

/** Which categories bill PEOPLE or WORKS rather than a running order. */
const PORTRAIT_BILL = new Set(["lineup", "speakers", "works", "djs"]);

/**
 * The bill as portrait cards.
 *
 * A headliner, a speaker and a painting are each a thing you look AT, so the
 * plate comes first and the name sits under it — the shape every tour poster,
 * conference site and gallery listing has converged on, and the one an eye
 * scans by picture rather than by line.
 *
 * The plate is generated artwork keyed to the accent until there is an upload,
 * for the reason this codebase learned the hard way: a photograph of the wrong
 * person is worse than none at all.
 */
function LineupCards({
  entries,
  narrow,
  variant,
  theme,
  accent,
  labels,
  featured,
}: {
  entries: EventRecord["lineup"];
  narrow: boolean;
  variant: string;
  theme: EventTheme;
  accent: string;
  labels: Labels;
  /** Show this many, with a control for the rest. Undefined shows them all. */
  featured?: number;
}) {
  const big = variant === "poster" || variant === "neon";
  const [all, setAll] = useState(false);
  const shown = featured && !all ? entries.slice(0, featured) : entries;
  const hidden = entries.length - shown.length;
  return (
    <>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: narrow ? "repeat(2, 1fr)" : `repeat(${Math.min(shown.length, 4)}, 1fr)`,
        gap: narrow ? 12 : 20,
      }}
    >
      {shown.map((e, i) => (
        /* On the conference layout the name sits INSIDE the card, on its own
           footer, so a row of them reads as four cards rather than four plates
           with captions floating under them. */
        <div
          key={e.id}
          style={{
            minWidth: 0,
            ...(featured
              ? {
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "var(--e-radius)",
                  border: `1px solid var(--e-line)`,
                  overflow: "hidden",
                  background: "var(--e-panel)",
                }
              : {}),
          }}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "3 / 4",
              borderRadius: featured ? 0 : "var(--e-radius)",
              border: featured ? "none" : `1px solid var(--e-line)`,
              borderBottom: featured ? `1px solid var(--e-line)` : undefined,
              background: plateArt(accent, i, isLight(theme.bg)),
              overflow: "hidden",
            }}
          >
            {/* The billing position, kept on the plate rather than beside the
                name: it indexes the picture, and outlined so a six-name bill
                is not a column of loud numerals. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: narrow ? 8 : 12,
                left: narrow ? 10 : 14,
                font: `700 ${narrow ? "20px" : "28px"}/1 var(--e-display)`,
                letterSpacing: theme.displayTracking,
                color: "transparent",
                WebkitTextStroke: `1px var(--e-accent)`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {e.at && (
              <span
                style={{
                  position: "absolute",
                  left: narrow ? 8 : 12,
                  bottom: narrow ? 8 : 12,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "var(--e-accent)",
                  color: "var(--e-on-accent)",
                  font: "600 12px/1 var(--e-body)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {e.at}
              </span>
            )}
          </div>
          <div style={featured ? { padding: narrow ? "12px 14px" : "14px 16px", flex: 1 } : undefined}>
            <p
              style={{
                font: `${big ? 700 : 600} ${narrow ? (big ? "17px" : "15px") : big ? "22px" : "16px"}/1.25 var(--e-display)`,
                letterSpacing: theme.displayTracking,
                textTransform: big ? "uppercase" : "none",
                color: "var(--e-fg)",
                margin: featured ? 0 : `${narrow ? 10 : 14}px 0 0`,
                overflowWrap: "anywhere",
              }}
            >
              {e.name}
            </p>
            {e.role && (
              <p style={{ font: "400 13px/1.45 var(--e-body)", color: "var(--e-muted)", margin: "5px 0 0" }}>{e.role}</p>
            )}
          </div>
        </div>
      ))}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            marginTop: narrow ? 18 : 24,
            minHeight: 44,
            padding: 0,
            border: 0,
            background: "none",
            cursor: "pointer",
            font: "600 14px/1 var(--e-body)",
            color: "var(--e-accent-ink)",
          }}
        >
          {labels.viewAllSpeakers}
          <ArrowRight size={14} strokeWidth={2} aria-hidden />
        </button>
      )}
    </>
  );
}

function VideoPlayer({
  video,
  accent,
  light,
  labels,
  narrow,
}: {
  video: NonNullable<ReturnType<typeof parseEventVideo>>;
  accent: string;
  light: boolean;
  labels: Labels;
  narrow: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        borderRadius: "var(--e-radius)",
        overflow: "hidden",
        border: `1px solid var(--e-line)`,
        // Vimeo publishes no poster without an API call, so it falls through to
        // the template's own plate rather than to an empty rectangle.
        background: [...video.posters.map((u) => `url(${u}) center/cover`), artFor(accent, 1, light)].join(", "),
      }}
    >
      {playing ? (
        <iframe
          src={video.embedUrl}
          title={labels.video}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={labels.playVideo}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            border: 0,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            // A scrim under the button, so the play target reads against a
            // bright frame as well as a dark one.
            background: "linear-gradient(180deg, rgb(0 0 0 / 0.12), rgb(0 0 0 / 0.42))",
          }}
        >
          <span
            aria-hidden
            style={{
              width: narrow ? 58 : 78,
              height: narrow ? 58 : 78,
              borderRadius: 999,
              background: "var(--e-accent)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 10px 34px rgb(0 0 0 / 0.34)",
            }}
          >
            <Play
              size={narrow ? 22 : 30}
              strokeWidth={2}
              fill="var(--e-on-accent)"
              style={{ color: "var(--e-on-accent)", marginLeft: 3 }}
            />
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * The sponsor wall.
 *
 * Grouped by the operator's own word for the level — Headline, Partner,
 * Supporter — because that grouping IS the information: a headline sponsor
 * paid for the right to be read first, and a flat alphabetical grid throws
 * away the only thing the section is for. Names are set on plates rather than
 * dropped as bare text so the wall reads as a wall.
 */
function SponsorWall({
  sponsors,
  narrow,
  theme,
  upper,
}: {
  sponsors: EventRecord["sponsors"];
  narrow: boolean;
  theme: EventTheme;
  upper: boolean;
}) {
  const groups: { tier: string | undefined; items: EventRecord["sponsors"] }[] = [];
  for (const sp of sponsors) {
    const g = groups.find((x) => x.tier === sp.tier);
    if (g) g.items.push(sp);
    else groups.push({ tier: sp.tier, items: [sp] });
  }
  return (
    <div style={{ display: "grid", gap: narrow ? 22 : 30 }}>
      {groups.map((g, gi) => (
        <div key={g.tier ?? `g${gi}`}>
          {g.tier && (
            <p
              style={{
                font: "600 12px/1 var(--e-body)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--e-muted)",
                margin: "0 0 12px",
                textAlign: "center",
              }}
            >
              {g.tier}
            </p>
          )}
          {/* Centred and wrapped rather than laid on a grid.
              A grid with auto-fill leaves two headline plates sitting against
              the left edge of five empty tracks, which reads as a wall somebody
              stopped building; stretching two plates across the full width
              instead makes each one the size of a billboard. Centred rows are
              what a sponsor wall has always been, and the first group's larger
              plate is how it says rank. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "stretch",
              gap: narrow ? 8 : 14,
            }}
          >
            {g.items.map((sp) => (
              <div
                key={sp.id}
                style={{
                  display: "grid",
                  placeItems: "center",
                  flex: narrow ? "1 1 calc(50% - 8px)" : "0 1 auto",
                  minWidth: narrow ? 0 : gi === 0 ? 230 : 168,
                  minHeight: narrow ? 64 : gi === 0 ? 100 : 78,
                  padding: "12px 16px",
                  borderRadius: "var(--e-radius)",
                  border: `1px solid var(--e-line)`,
                  background: "var(--e-panel)",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    font: `600 ${narrow ? "13px" : gi === 0 ? "19px" : "15px"}/1.25 var(--e-display)`,
                    letterSpacing: theme.displayTracking,
                    textTransform: upper ? "uppercase" : "none",
                    color: "var(--e-fg)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {sp.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The agenda.
 *
 * Day tabs where the entries carry days, one plain track where they do not.
 * A three-day conference printed as one forty-row column is the commonest way
 * an agenda becomes unreadable, and a tab strip holding a single tab is a
 * control that decides nothing — so the shape follows the data rather than the
 * category.
 *
 * Real tabs, not styled buttons: `tablist`/`tab`/`tabpanel` with arrow-key
 * movement, because this is exactly the widget that pattern exists for and a
 * keyboard user should not have to tab through every day to reach the last.
 */
function Agenda({
  entries,
  narrow,
  labels,
  upper,
}: {
  entries: EventRecord["lineup"];
  narrow: boolean;
  labels: Labels;
  upper: boolean;
}) {
  const days: string[] = [];
  for (const e of entries) if (e.day && !days.includes(e.day)) days.push(e.day);
  const [active, setActive] = useState(0);

  if (days.length < 2) return <ScheduleList entries={entries} narrow={narrow} />;

  const current = days[Math.min(active, days.length - 1)];
  const move = (delta: number) => setActive((i) => (i + delta + days.length) % days.length);

  return (
    <div style={{ display: "grid", gap: narrow ? 16 : 28, gridTemplateColumns: narrow ? "1fr" : "190px minmax(0, 1fr)" }}>
      <div
        role="tablist"
        aria-label={labels.schedule}
        style={{ display: "flex", flexDirection: narrow ? "row" : "column", flexWrap: "wrap", gap: 8 }}
      >
        {days.map((d, i) => {
          const on = i === active;
          return (
            <button
              key={d}
              role="tab"
              id={`agenda-tab-${i}`}
              aria-selected={on}
              aria-controls={`agenda-panel-${i}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(ev) => {
                if (ev.key === "ArrowDown" || ev.key === "ArrowRight") { ev.preventDefault(); move(1); }
                if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") { ev.preventDefault(); move(-1); }
              }}
              style={{
                textAlign: "left",
                cursor: "pointer",
                padding: narrow ? "10px 14px" : "14px 16px",
                minHeight: 44,
                borderRadius: "var(--e-radius)",
                border: `1px solid ${on ? "var(--e-accent)" : "var(--e-line)"}`,
                background: on ? "var(--e-accent)" : "var(--e-panel)",
                color: on ? "var(--e-on-accent)" : "var(--e-fg)",
                font: `600 ${narrow ? "13px" : "15px"}/1.2 var(--e-body)`,
                letterSpacing: upper ? "0.06em" : 0,
                textTransform: upper ? "uppercase" : "none",
                flex: narrow ? "0 0 auto" : undefined,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`agenda-panel-${active}`} aria-labelledby={`agenda-tab-${active}`}>
        <ScheduleList entries={entries.filter((e) => e.day === current)} narrow={narrow} />
      </div>
    </div>
  );
}

/** "Dhaka FC vs Port City United" — the two sides, and the VS between them.
 *
 *  Split on the word rather than modelled as two fields: an operator types a
 *  fixture the way it is written on a board, and a form asking for "home" and
 *  "away" would be a form for exactly one kind of sport. A row with no `vs` in
 *  it is a talk, a class or a heat, and falls through to the plain shape. */
const VS = /\s+(?:vs\.?|v\.?|versus)\s+/i;

function ScheduleList({ entries, narrow }: { entries: EventRecord["lineup"]; narrow: boolean }) {
  // A schedule reads down the time column, so the time leads and gets a rail.
  return (
    <div style={{ display: "grid", gap: 0 }}>
      {entries.map((e, i) => (
        <div
          key={e.id}
          style={{
            display: "grid",
            gridTemplateColumns: narrow ? "72px 1fr" : "120px 1fr",
            gap: narrow ? 14 : 24,
            padding: `${narrow ? 14 : 18}px 0`,
            borderTop: i ? `1px solid var(--e-line)` : "none",
          }}
        >
          <p
            style={{
              font: "600 14px/1.4 var(--e-body)",
              color: "var(--e-accent-ink)",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {e.at ?? "—"}
          </p>
          <div style={{ minWidth: 0 }}>
            {(() => {
              const sides = e.name.split(VS);
              if (sides.length !== 2) {
                return (
                  <p style={{ font: `600 ${narrow ? "15px" : "17px"}/1.35 var(--e-body)`, color: "var(--e-fg)", margin: 0, overflowWrap: "anywhere" }}>
                    {e.name}
                  </p>
                );
              }
              return (
                <div style={{ display: "flex", alignItems: "center", gap: narrow ? 10 : 16, minWidth: 0 }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "right",
                      font: `600 ${narrow ? "14px" : "17px"}/1.3 var(--e-body)`,
                      color: "var(--e-fg)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {sides[0].trim()}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      padding: "4px 9px",
                      borderRadius: 999,
                      border: `1px solid var(--e-line)`,
                      background: "var(--e-panel)",
                      font: "600 11px/1 var(--e-body)",
                      letterSpacing: "0.1em",
                      color: "var(--e-accent-ink)",
                    }}
                  >
                    VS
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: `600 ${narrow ? "14px" : "17px"}/1.3 var(--e-body)`,
                      color: "var(--e-fg)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {sides[1].trim()}
                  </span>
                </div>
              );
            })()}
            {e.role && (
              <p
                style={{
                  font: "400 13px/1.5 var(--e-body)",
                  color: "var(--e-muted)",
                  margin: "6px 0 0",
                  textAlign: e.name.split(VS).length === 2 ? "center" : "left",
                }}
              >
                {e.role}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The ticket panel — the whole purchase, in a rail beside the argument for it.
 *
 * This replaces the three-across plan comparison the previous pass built. That
 * was right for a page where pricing is its own full-width section; it is wrong
 * here, because the brief puts the decision next to the reason and a rail is
 * 380px wide. A comparison needs columns. A decision needs a list, a running
 * subtotal and one button.
 *
 * The counterfoil motif stays where it still reads at this width: a punched
 * edge down each row. The perforated tear does not survive a 90px-tall row, so
 * it is not drawn rather than drawn badly.
 */
function TicketPanel({
  event,
  narrow,
  labels,
  theme,
}: {
  event: EventRecord;
  narrow: boolean;
  labels: Labels;
  theme: EventTheme;
}) {
  const all = event.tiers.filter((t) => t.quantity > 0);
  const live = all.filter((t) => t.quantity - t.sold > 0);
  const gone = all.filter((t) => t.quantity - t.sold <= 0);
  /* "Most popular" is read off the ledger, never chosen: the best-selling tier,
     and only when it is meaningfully ahead of the next. A badge that sits on
     whatever the operator wants to push is an advertisement wearing the clothes
     of a fact. */
  const ranked = [...live].sort((a, b) => b.sold - a.sold);
  const popularId =
    ranked.length >= 3 && ranked[0].sold >= Math.max(1, ranked[1].sold * 1.25) ? ranked[0].id : null;

  return (
    <div
      id="tickets"
      style={{
        scrollMarginTop: narrow ? 60 : 68,
        borderRadius: "var(--e-radius)",
        border: `1px solid var(--e-line)`,
        background: "var(--e-bg)",
        padding: narrow ? "18px" : "22px 24px",
        boxShadow: "0 18px 48px rgb(15 23 42 / 0.08)",
        position: narrow ? undefined : "sticky",
        // Clears the page's own sticky bar, so the panel never slides under it.
        top: narrow ? undefined : 76,
      }}
    >
      <p
        style={{
          font: `600 ${narrow ? "17px" : "19px"}/1.3 var(--e-display)`,
          letterSpacing: theme.displayTracking,
          color: "var(--e-fg)",
          margin: 0,
        }}
      >
        {labels.chooseTicket}
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: narrow ? 14 : 18 }}>
        {live.map((t) => {
          const left = t.quantity - t.sold;
          const scarce = left <= Math.max(1, Math.round(t.quantity * 0.15));
          const popular = t.id === popularId;
          return (
            <div
              key={t.id}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                overflow: "hidden",
                padding: narrow ? "13px 13px 13px 19px" : "15px 15px 15px 22px",
                borderRadius: "var(--e-radius)",
                border: `1px solid ${popular || scarce ? "var(--e-accent)" : "var(--e-line)"}`,
                background: "var(--e-panel)",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: -5,
                  top: 0,
                  bottom: 0,
                  width: 10,
                  background: `radial-gradient(circle at 50% 50%, var(--e-bg) 4.5px, transparent 5px) 0 0 / 10px 14px repeat-y`,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ font: `600 ${narrow ? "14px" : "15px"}/1.3 var(--e-body)`, color: "var(--e-fg)" }}>
                    {t.name}
                  </span>
                  {popular ? (
                    <Badge tone="accent">{labels.mostPopular}</Badge>
                  ) : scarce ? (
                    <Badge tone="accent">{labels.almostGone}</Badge>
                  ) : null}
                </div>
                <p style={{ margin: "7px 0 0", display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span
                    style={{
                      font: `600 ${narrow ? "20px" : "22px"}/1.1 var(--e-display)`,
                      letterSpacing: theme.displayTracking,
                      color: "var(--e-fg)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {t.price === 0 ? labels.free : formatMoney(t.price)}
                  </span>
                  <span style={{ font: "400 13px/1.3 var(--e-body)", color: "var(--e-muted)" }}>{labels.perPerson}</span>
                </p>
                {t.perks && t.perks.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "9px 0 0", display: "grid", gap: 5 }}>
                    {/* Two, at this width. A rail is not the place for a
                        four-item feature list, and the two the operator wrote
                        first are the two they thought mattered. */}
                    {t.perks.slice(0, 2).map((perk, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span
                          aria-hidden
                          style={{ width: 4, height: 4, borderRadius: 999, background: "var(--e-accent)", marginTop: 7, flexShrink: 0 }}
                        />
                        <span style={{ font: "400 13px/1.45 var(--e-body)", color: "var(--e-muted)" }}>{perk}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* A stepper you can read but not drive: this page is a preview of
                  a checkout that lives at the till, and a control that looks
                  live and does nothing is worse than one that is plainly a
                  picture of the real thing. */}
              <div
                aria-hidden
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  border: `1px solid var(--e-line)`,
                  borderRadius: 999,
                  padding: 3,
                  flexShrink: 0,
                  background: "var(--e-bg)",
                }}
              >
                {["\u2212", "0", "+"].map((g, i) => (
                  <span
                    key={i}
                    style={{
                      width: 24,
                      height: 24,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 999,
                      font: "500 13px/1 var(--e-body)",
                      color: i === 1 ? "var(--e-fg)" : "var(--e-muted)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* A tier that has gone is stated, not offered. */}
      {gone.length > 0 && (
        <div style={{ display: "grid", gap: 0, marginTop: 12 }}>
          {gone.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 0",
                borderTop: `1px solid var(--e-line)`,
              }}
            >
              <span style={{ font: "500 13px/1.3 var(--e-body)", color: "var(--e-muted)", minWidth: 0 }}>{t.name}</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0 }}>
                <span
                  style={{
                    font: "400 13px/1.3 var(--e-body)",
                    color: "var(--e-muted)",
                    textDecoration: "line-through",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t.price === 0 ? labels.free : formatMoney(t.price)}
                </span>
                <Badge tone="muted">{labels.soldOutBadge}</Badge>
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid var(--e-line)`,
        }}
      >
        <span style={{ font: "400 14px/1.3 var(--e-body)", color: "var(--e-muted)" }}>{labels.subtotal}</span>
        <span
          style={{
            font: `600 ${narrow ? "17px" : "19px"}/1.1 var(--e-display)`,
            letterSpacing: theme.displayTracking,
            color: "var(--e-fg)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatMoney(0)}
        </span>
      </div>

      <a
        href="#tickets"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 14,
          height: narrow ? 46 : 50,
          borderRadius: "var(--e-radius)",
          background: "var(--e-accent)",
          color: "var(--e-on-accent)",
          font: `600 ${narrow ? "14px" : "15px"}/1 var(--e-body)`,
          textDecoration: "none",
        }}
      >
        {labels.checkout}
        <ArrowRight size={16} strokeWidth={2} aria-hidden />
      </a>
      <p
        style={{
          font: "400 12px/1.4 var(--e-body)",
          color: "var(--e-muted)",
          margin: "11px 0 0",
          textAlign: "center",
        }}
      >
        {labels.checkoutTrust}
      </p>
    </div>
  );
}

/**
 * The ticket block — the one thing this page exists to do, and the page's
 * signature.
 *
 * A counterfoil IS a ticket stub, so the tiers are drawn as stubs: a punched
 * edge down the left, a perforated tear before the price, and a summary panel
 * underneath that reads like the receipt you are about to be handed. It is the
 * only place the product's own name earns a motif, and it sits exactly where
 * the commercial decision is made.
 *
 * What a tier BUYS is listed, because a price with nothing beside it makes a
 * buyer work out the difference between two tiers from their names alone.
 */
function TicketTable({
  event,
  narrow,
  labels,
  theme,
  structured = false,
}: {
  event: EventRecord;
  narrow: boolean;
  labels: Labels;
  theme: EventTheme;
  /** The business layout: three passes side by side, compared rather than
   *  browsed. That is how every conference sells, and it is the one place the
   *  stub grid is the wrong shape — a delegate is choosing BETWEEN passes, not
   *  reading each one in turn. */
  structured?: boolean;
}) {
  const all = event.tiers.filter((t) => t.quantity > 0);
  /* In the comparison layout a tier that has gone is not a column.
     Four plans in a three-column grid put the sold-out early bird alone on a
     fourth row with two empty columns beside it — and a plan nobody can buy
     has no business taking a third of a comparison of plans they can. It is
     still stated, as a line underneath: "gone" is information a buyer wants,
     it just is not an option. */
  const live = structured ? all.filter((t) => t.quantity - t.sold > 0) : all;
  const gone = structured ? all.filter((t) => t.quantity - t.sold <= 0) : [];
  /* "Most popular" is read off the ledger, never chosen: the best-selling tier,
     and only when it is meaningfully ahead of the next one. A badge that sits
     on whatever the operator wants to push is an advertisement wearing the
     clothes of a fact. */
  const ranked = [...live].sort((a, b) => b.sold - a.sold);
  const popularId =
    structured && ranked.length >= 3 && ranked[0].sold >= Math.max(1, ranked[1].sold * 1.25)
      ? ranked[0].id
      : null;
  return (
    <div style={{ display: "grid", gap: narrow ? 12 : 16 }}>
      <div
        style={{
          display: "grid",
          gap: narrow ? 12 : 16,
          gridTemplateColumns: narrow
            ? "1fr"
            : structured
              ? `repeat(${Math.min(live.length, 3)}, minmax(0, 1fr))`
              : "repeat(2, 1fr)",
          alignItems: "stretch",
        }}
      >
        {live.map((t, i) => {
          const left = Math.max(0, t.quantity - t.sold);
          const out = left === 0;
          const scarce = !out && left <= Math.max(1, Math.round(t.quantity * 0.15));
          /* A badge on every available tier is a badge on nothing: the first
             build read "TICKETS SELLING FAST" beside all four tiers, including
             one that had sold 31% of four thousand. It now appears only where
             the ledger supports it — the same half-sold threshold the page's
             own sticky bar uses, so one rule governs both. */
          const moving = !out && !scarce && t.quantity > 0 && t.sold / t.quantity >= 0.5;
          /* The last card fills its row rather than leaving a hole beside it.
             Three-up compares plans column by column, so a stretched last card
             there would break the comparison it exists for. */
          const spans = !structured && !narrow && i === live.length - 1 && live.length % 2 === 1;
          const popular = t.id === popularId;
          return (
            <div
              key={t.id}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gridColumn: spans ? "span 2" : undefined,
                borderRadius: "var(--e-radius)",
                border: `1px solid ${popular || scarce ? "var(--e-accent)" : "var(--e-line)"}`,
                /* The featured plan is raised, not recoloured. Colour here
                   would collide with scarcity, which is already spending the
                   accent on the border. */
                boxShadow: popular ? "0 14px 40px rgb(15 23 42 / 0.12)" : undefined,
                marginTop: popular && !narrow ? -12 : undefined,
                marginBottom: popular && !narrow ? -12 : undefined,
                background: "var(--e-panel)",
                overflow: "hidden",
                opacity: out ? 0.55 : 1,
              }}
            >
              {/* The punched edge. */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: -5,
                  top: 0,
                  bottom: 0,
                  width: 10,
                  background: `radial-gradient(circle at 50% 50%, var(--e-bg) 4.5px, transparent 5px) 0 0 / 10px 14px repeat-y`,
                }}
              />
              {popular && (
                <p
                  style={{
                    margin: 0,
                    padding: "8px 12px",
                    background: "var(--e-accent)",
                    color: "var(--e-on-accent)",
                    font: "600 12px/1 var(--e-body)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {labels.mostPopular}
                </p>
              )}
              <div style={{ flex: 1, padding: narrow ? "16px 16px 0 22px" : "20px 22px 0 28px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: structured ? "flex-start" : "flex-start",
                    flexDirection: structured ? "column" : "row",
                    justifyContent: "space-between",
                    gap: structured ? 10 : 10,
                  }}
                >
                  <p
                    style={{
                      font: `600 ${narrow ? "15px" : "16px"}/1.3 var(--e-body)`,
                      color: "var(--e-fg)",
                      margin: 0,
                      textTransform: theme.eyebrowCase === "upper" ? "uppercase" : "none",
                      letterSpacing: theme.eyebrowCase === "upper" ? "0.06em" : 0,
                    }}
                  >
                    {t.name}
                  </p>
                  {out ? (
                    <Badge tone="muted">{labels.soldOutBadge}</Badge>
                  ) : scarce ? (
                    <Badge tone="accent">{labels.almostGone}</Badge>
                  ) : moving && !popular ? (
                    <Badge tone="accent">{labels.sellingFast}</Badge>
                  ) : null}
                </div>
                {t.description && (
                  <p style={{ font: "400 13px/1.6 var(--e-body)", color: "var(--e-muted)", margin: "8px 0 0" }}>{t.description}</p>
                )}
                {t.perks && t.perks.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
                    {t.perks.map((perk, i) => (
                      <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                        <span
                          aria-hidden
                          style={{ width: 4, height: 4, borderRadius: 999, background: "var(--e-accent)", marginTop: 7, flexShrink: 0 }}
                        />
                        <span style={{ font: "400 13px/1.5 var(--e-body)", color: "var(--e-muted)" }}>{perk}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* The tear, then the money. */}
              <div
                aria-hidden
                style={{
                  margin: narrow ? "16px 16px 0 22px" : "20px 22px 0 28px",
                  height: 1,
                  background: `repeating-linear-gradient(to right, var(--e-line) 0 5px, transparent 5px 11px)`,
                }}
              />
              <div
                style={{
                  padding: narrow ? "14px 16px 16px 22px" : "16px 22px 20px 28px",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      font: `600 ${narrow ? "20px" : "24px"}/1.1 var(--e-display)`,
                      color: out ? "var(--e-muted)" : "var(--e-accent-ink)",
                      margin: 0,
                      letterSpacing: theme.displayTracking,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.price === 0 ? labels.free : formatMoney(t.price)}
                  </p>
                  {!out && (
                    <p style={{ font: "400 12px/1.4 var(--e-body)", color: "var(--e-muted)", margin: "5px 0 0" }}>
                      {labels.remaining.replace("{count}", String(left))}
                    </p>
                  )}
                </div>
                {/* A stepper you can read but not drive: the page is a preview
                    of a checkout that lives at the till, and a control that
                    looks live and does nothing is worse than one that is
                    plainly a picture of the real thing. */}
                <div
                  aria-hidden
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    border: `1px solid var(--e-line)`,
                    borderRadius: 999,
                    padding: 3,
                    flexShrink: 0,
                    opacity: out ? 0.4 : 1,
                  }}
                >
                  {["−", "0", "+"].map((g, i) => (
                    <span
                      key={i}
                      style={{
                        width: 26,
                        height: 26,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 999,
                        font: "500 13px/1 var(--e-body)",
                        color: i === 1 ? "var(--e-fg)" : "var(--e-muted)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {gone.length > 0 && (
        <div style={{ display: "grid", gap: 0 }}>
          {gone.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 14,
                padding: `${narrow ? 12 : 14}px 0`,
                borderTop: i ? `1px solid var(--e-line)` : "none",
              }}
            >
              <span
                style={{
                  font: `600 ${narrow ? "14px" : "15px"}/1.3 var(--e-body)`,
                  color: "var(--e-muted)",
                  textTransform: theme.eyebrowCase === "upper" ? "uppercase" : "none",
                  letterSpacing: theme.eyebrowCase === "upper" ? "0.06em" : 0,
                  minWidth: 0,
                }}
              >
                {t.name}
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 14, flexShrink: 0 }}>
                <span
                  style={{
                    font: "400 14px/1.3 var(--e-body)",
                    color: "var(--e-muted)",
                    textDecoration: "line-through",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t.price === 0 ? labels.free : formatMoney(t.price)}
                </span>
                <Badge tone="muted">{labels.soldOutBadge}</Badge>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The receipt. It states a zero total on purpose — nothing is chosen
          yet, and a summary that hides until you act is a summary nobody
          learns to look for. */}
      <div
        style={{
          borderRadius: "var(--e-radius)",
          border: `1px solid var(--e-line)`,
          background: "var(--e-panel)",
          padding: narrow ? "16px" : "20px 22px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                font: "600 12px/1 var(--e-body)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--e-muted)",
                margin: 0,
              }}
            >
              {labels.orderSummary}
            </p>
            <p style={{ font: "400 13px/1.5 var(--e-body)", color: "var(--e-muted)", margin: "7px 0 0" }}>{labels.orderHint}</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p
              style={{
                font: "600 12px/1 var(--e-body)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--e-muted)",
                margin: 0,
              }}
            >
              {labels.total}
            </p>
            <p
              style={{
                font: `600 ${narrow ? "20px" : "24px"}/1.1 var(--e-display)`,
                color: "var(--e-fg)",
                margin: "7px 0 0",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: theme.displayTracking,
              }}
            >
              {formatMoney(0)}
            </p>
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            height: narrow ? 46 : 50,
            borderRadius: 999,
            background: "var(--e-accent)",
            color: "var(--e-on-accent)",
            display: "grid",
            placeItems: "center",
            font: `600 ${narrow ? "14px" : "15px"}/1 var(--e-body)`,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {labels.selectTickets}
        </div>
        <p
          style={{
            font: "400 12px/1.4 var(--e-body)",
            color: "var(--e-muted)",
            margin: "11px 0 0",
            textAlign: "center",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {labels.checkoutTrust}
        </p>
      </div>
    </div>
  );
}

/**
 * The venue plate.
 *
 * Wordless on purpose. An earlier version labelled it STAGE / GENERAL STANDING
 * / LEFT / RIGHT on every category, which meant a gallery page claimed a stage
 * and a boat trip claimed a room — the wrong-photograph mistake in another
 * medium. Decoration may be abstract; it may not state something untrue about
 * somebody's real building. The heading above it already names the venue and
 * the column beside it carries the address, so there is nothing left for the
 * plate to say.
 *
 * One distinction does change the drawing, because it is real: an event held
 * AT a place gets a map, and an event that MOVES gets a route.
 */
function VenueMap({ narrow, shape }: { narrow: boolean; shape: "map" | "route" | "pitch" }) {
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        aspectRatio: "16 / 10",
        borderRadius: "var(--e-radius)",
        border: `1px solid var(--e-line)`,
        background: "var(--e-panel)",
        overflow: "hidden",
      }}
    >
      {/* Blocks and streets. Two gradients rather than an asset: it costs no
          request, cannot 404, and takes the theme's own line colour. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(var(--e-line) 1px, transparent 1px), linear-gradient(90deg, var(--e-line) 1px, transparent 1px)`,
          backgroundSize: `${narrow ? 34 : 46}px ${narrow ? 34 : 46}px`,
          opacity: 0.75,
        }}
      />
      {shape === "pitch" ? (
        /* A pitch, drawn to its own markings. It states nothing that is not
           true of every pitch — a halfway line, a centre circle, two boxes —
           where the old labelled zones claimed a stage and a standing area
           inside somebody's real ground. */
        <svg viewBox="0 0 320 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <g
            fill="none"
            stroke="var(--e-accent)"
            strokeWidth="1.6"
            opacity="0.85"
            strokeLinejoin="round"
          >
            <rect x="18" y="16" width="284" height="168" rx="3" />
            <line x1="160" y1="16" x2="160" y2="184" />
            <circle cx="160" cy="100" r="30" />
            <rect x="18" y="56" width="42" height="88" />
            <rect x="260" y="56" width="42" height="88" />
            <rect x="18" y="80" width="16" height="40" />
            <rect x="286" y="80" width="16" height="40" />
          </g>
          <circle cx="160" cy="100" r="3" fill="var(--e-accent)" />
        </svg>
      ) : shape === "map" ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: "62%", height: narrow ? 7 : 10, background: "var(--e-line)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "24%", width: narrow ? 5 : 7, background: "var(--e-line)" }} />
          <div
            style={{
              position: "absolute",
              left: "54%",
              top: "44%",
              transform: "translate(-50%, -50%)",
              width: narrow ? 62 : 84,
              height: narrow ? 62 : 84,
              borderRadius: 999,
              background: `color-mix(in srgb, var(--e-accent) 18%, transparent)`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <span
              style={{
                width: narrow ? 34 : 44,
                height: narrow ? 34 : 44,
                borderRadius: 999,
                background: "var(--e-accent)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <MapPin size={narrow ? 17 : 21} strokeWidth={2} style={{ color: "var(--e-on-accent)" }} />
            </span>
          </div>
        </>
      ) : (
        <svg viewBox="0 0 320 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path
            d="M34 152 C 92 152, 96 66, 156 66 S 236 132, 288 52"
            fill="none"
            stroke="var(--e-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="9 9"
          />
          {[
            [34, 152],
            [156, 66],
            [288, 52],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="13" fill="var(--e-accent)" opacity="0.2" />
              <circle cx={cx} cy={cy} r="6" fill="var(--e-accent)" />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: "accent" | "muted"; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: "999px",
        font: "600 12px/1.2 var(--e-body)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        // Solid, not a transparent mix: the ink above is derived against this
        // exact composite, and a wash whose backdrop can change is a colour
        // nobody can guarantee a ratio for.
        background: tone === "accent" ? "var(--e-badge-bg)" : "var(--e-badge-muted-bg)",
        color: tone === "accent" ? "var(--e-badge-ink)" : "var(--e-muted)",
      }}
    >
      {children}
    </span>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** A little film noise. Inline SVG so it costs no request and cannot 404. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Composite `a` over `b` at `amount`, so a tint can be reasoned about as the
 *  solid colour it actually renders as. */
function mix(a: string, b: string, amount: number): string {
  const rgb = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((o) => parseInt(full.slice(o, o + 2), 16)) as [number, number, number];
  };
  try {
    const A = rgb(a), B = rgb(b);
    const C = [0, 1, 2].map((k) => Math.round(A[k] * amount + B[k] * (1 - amount)));
    return `rgb(${C[0]}, ${C[1]}, ${C[2]})`;
  } catch {
    return b;
  }
}

/** The accent, nudged until small text in it is actually readable on the page.
 *
 *  This is the same lesson the design system already paid for once: `ember` is
 *  correct as a FILL and fails as a letterform, which is why the app carries a
 *  separate `brand-foreground` step. Here the accent is operator-chosen, so the
 *  readable step cannot be a fixed token — it is computed. The raw accent still
 *  paints fills and large display type, where the 3:1 floor applies; anything
 *  small and accent-coloured uses this. */
function accentInk(accent: string, bg: string, fg: string): string {
  const rgb = (col: string): [number, number, number] => {
    const m = col.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",").map((x) => parseFloat(x));
      return [p[0], p[1], p[2]] as [number, number, number];
    }
    const h = col.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((o) => parseInt(full.slice(o, o + 2), 16)) as [number, number, number];
  };
  const lum = ([r, g, b]: [number, number, number]) => {
    const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: [number, number, number], b: [number, number, number]) => {
    const A = lum(a), B = lum(b);
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
  };
  let A: [number, number, number], B: [number, number, number], F: [number, number, number];
  try { A = rgb(accent); B = rgb(bg); F = rgb(fg); } catch { return accent; }
  if (ratio(A, B) >= 4.5) return accent;
  // Walk toward the page's own foreground, which is by definition readable on
  // this ground, and stop at the first step that clears the floor — so the
  // colour keeps as much of its own hue as it can afford.
  for (let i = 1; i <= 20; i++) {
    const m = i / 20;
    const C: [number, number, number] = [0, 1, 2].map((k) => Math.round(A[k] + (F[k] - A[k]) * m)) as [number, number, number];
    if (ratio(C, B) >= 4.5) return `rgb(${C[0]}, ${C[1]}, ${C[2]})`;
  }
  return fg;
}

/** Cover art when the operator has not uploaded any.
 *  A themed abstract beats both an empty rectangle and a stock photograph of
 *  the wrong place — a lesson this codebase already paid for once. */
function artFor(accent: string, i: number, strong = false): string {
  const angle = [135, 200, 45, 300, 20, 260][i % 6];
  // Light themes need more of the accent, not less: the same 55% wash that
  // reads as vivid over near-black turns to grey mush over warm paper, which
  // is what a gallery of blank plates looked like on the editorial theme.
  const a = strong ? 92 : 55;
  const b = strong ? 62 : 30;
  return [
    `radial-gradient(circle at ${20 + i * 12}% ${18 + i * 9}%, color-mix(in srgb, ${accent} ${a}%, transparent), transparent 62%)`,
    `radial-gradient(circle at ${85 - i * 8}% ${72 - i * 6}%, color-mix(in srgb, ${accent} ${b}%, transparent), transparent 56%)`,
    `linear-gradient(${angle}deg, var(--e-panel), var(--e-bg))`,
  ].join(", ");
}

/**
 * The same wash with a ruled motif over it, for the gallery and the bill.
 *
 * `artFor` alone is soft radial gradient, which is right behind a hero — and
 * wrong in a grid, where a row of soft blurs reads as photographs that failed
 * to load rather than as plates somebody drew. One family of fine rules, at a
 * different angle per tile, is enough to say "deliberate" without competing
 * with the ticket block, which is where this page spends its boldness.
 */
function plateArt(accent: string, i: number, strong = false): string {
  const angle = [22, 112, 67, 157, 0, 90][i % 6];
  return [
    `repeating-linear-gradient(${angle}deg, color-mix(in srgb, ${accent} ${strong ? 26 : 20}%, transparent) 0 1.5px, transparent 1.5px 13px)`,
    artFor(accent, i, strong),
  ].join(", ");
}

/** Is this theme's ground light? Decides how hard the cover art has to push. */
function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) > 0.4;
}

/** Black or white on the chosen accent, whichever actually reads.
 *  An operator can pick any of the six swatches; the ink on top has to follow
 *  rather than stay at whatever the theme shipped with. */
function onAccent(accent: string, fallback: string): string {
  const hex = accent.replace("#", "");
  if (hex.length !== 6) return fallback;
  const [r, g, b] = [0, 2, 4].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contrast against white vs against near-black, and take the winner.
  return (1.05) / (L + 0.05) >= (L + 0.05) / 0.05 ? "#FFFFFF" : "#0B0B0B";
}

const longDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

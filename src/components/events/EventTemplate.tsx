"use client";

import type { CSSProperties } from "react";
import { CalendarDays, Clock, MapPin, Ticket } from "lucide-react";
import type { EventRecord } from "@/lib/api/events";
import { eventFromPrice } from "@/lib/api/events";
import { categoryById, type SectionId } from "@/lib/events/catalog";
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
  left: string;
  countdownDays: string;
  countdownHours: string;
  countdownMins: string;
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
            font: `600 ${narrow ? "11px" : "12px"}/1 var(--e-body)`,
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
  /* Numbered by their place among the sections that ACTUALLY carry a header.
     Counting hero and countdown made the first visible index read "03", with
     01 and 02 nowhere on the page — a numbering that invites the reader to
     look for something that was never drawn. Hiding a section still renumbers
     the rest rather than leaving a gap. */
  const NUMBERED: SectionId[] = c.sections.filter((x) => x !== "hero" && x !== "countdown");
  const indexOf = (id: SectionId) => NUMBERED.indexOf(id) + 1;


  const draw: Record<SectionId, () => React.ReactNode> = {
    hero: () => (
      <Hero event={event} variant={variant} narrow={narrow} theme={t} labels={labels} pad={pad} upper={upper} />
    ),
    countdown: () => (
      <Countdown to={start} now={now} narrow={narrow} pad={pad} labels={labels} upper={upper} glow={t.glow} />
    ),
    about: () =>
      event.description ? (
        <Section id="about" index={indexOf("about")} eyebrow={labels.about} title={event.subtitle || labels.about}>
          <p
            style={{
              font: `400 ${narrow ? "15px" : "18px"}/1.7 var(--e-body)`,
              color: "var(--e-muted)",
              maxWidth: "62ch",
              margin: 0,
            }}
          >
            {event.description}
          </p>
        </Section>
      ) : null,
    lineup: () =>
      event.lineup.length ? (
        <Section id="lineup" index={indexOf("lineup")} eyebrow={labels.lineup} title={labels.lineup}>
          <LineupList entries={event.lineup} narrow={narrow} variant={variant} theme={t} />
        </Section>
      ) : null,
    schedule: () =>
      event.lineup.length ? (
        <Section id="schedule" index={indexOf("schedule")} eyebrow={labels.schedule} title={labels.schedule}>
          <ScheduleList entries={event.lineup} narrow={narrow} />
        </Section>
      ) : null,
    gallery: () => (
      <Section id="gallery" index={indexOf("gallery")} eyebrow={labels.gallery} title={labels.gallery}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: narrow ? 8 : 14,
          }}
        >
          {/* Five plates on a 4-column grid: one leading tile two wide and two
              tall, four squares filling the rest exactly. The previous six-up
              spilled to seven column-units and left a hole on the second row. */}
          {[0, 1, 2, 3, 4].slice(0, narrow ? 4 : 5).map((i) => (
            <div
              key={i}
              aria-hidden
              style={{
                aspectRatio: "1 / 1",
                gridColumn: i === 0 && !narrow ? "span 2" : undefined,
                gridRow: i === 0 && !narrow ? "span 2" : undefined,
                borderRadius: "var(--e-radius)",
                background: artFor(c.accent, i, isLight(t.bg)),
                border: `1px solid var(--e-line)`,
              }}
            />
          ))}
        </div>
      </Section>
    ),
    tickets: () => (
      <Section id="tickets" index={indexOf("tickets")} eyebrow={labels.tickets} title={labels.tickets}>
        <TicketTable event={event} narrow={narrow} labels={labels} theme={t} />
      </Section>
    ),
    venue: () => (
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
          <div
            aria-hidden
            style={{
              aspectRatio: "16 / 9",
              borderRadius: "var(--e-radius)",
              border: `1px solid var(--e-line)`,
              background: `linear-gradient(135deg, var(--e-panel), var(--e-bg))`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <MapPin size={narrow ? 22 : 28} strokeWidth={1.5} style={{ color: "var(--e-accent)" }} />
          </div>
        </div>
      </Section>
    ),
    faq: () =>
      event.faq.length ? (
        <Section id="faq" index={indexOf("faq")} eyebrow={labels.faq} title={labels.faq}>
          <div style={{ display: "grid", gap: 0, maxWidth: "72ch" }}>
            {event.faq.map((f, i) => (
              <div key={f.id} style={{ borderTop: i ? `1px solid var(--e-line)` : "none", padding: "18px 0" }}>
                <p style={{ font: "600 16px/1.4 var(--e-body)", color: "var(--e-fg)", margin: 0 }}>{f.q}</p>
                <p style={{ font: "400 15px/1.65 var(--e-body)", color: "var(--e-muted)", margin: "6px 0 0" }}>{f.a}</p>
              </div>
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
        {c.sections.map((s, i) => (
          <div key={s}>
            {draw[s]?.()}
            {/* Straight after the hero, a ticker of the three facts that matter.
                It is the one moving thing on the page and it earns that by
                repeating what a poster would shout: what, when, where. */}
            {i === 0 && <Marquee event={event} start={start} narrow={narrow} />}
          </div>
        ))}

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
            <p style={{ font: `600 ${narrow ? "17px" : "20px"}/1.2 var(--e-display)`, color: "var(--e-fg)", margin: "2px 0 0" }}>
              {fromPrice === null ? labels.soldOut : fromPrice === 0 ? labels.free : formatMoney(fromPrice)}
            </p>
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
}: {
  event: EventRecord;
  variant: string;
  narrow: boolean;
  theme: ReturnType<typeof categoryById>["theme"];
  labels: Labels;
  pad: string;
  upper: boolean;
}) {
  const start = new Date(event.startsAt);
  const cover = event.customisation.coverUrl;
  const art = cover ? undefined : artFor(event.customisation.accent, 0, isLight(theme.bg));

  const meta = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: narrow ? "10px 18px" : "12px 28px", marginTop: narrow ? 18 : 26 }}>
      {[
        { icon: CalendarDays, text: longDate(start) },
        { icon: Clock, text: `${time(start)} · ${labels.doorsOpen}` },
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

  // ── immersive / poster / neon: art behind, content over a scrim ──────────
  if (variant === "immersive" || variant === "poster" || variant === "neon") {
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
            <p style={{ font: `400 ${narrow ? "15px" : "19px"}/1.5 var(--e-body)`, color: "var(--e-muted)", margin: "14px 0 0", maxWidth: "48ch" }}>
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
            <p style={{ font: `400 ${narrow ? "15px" : "19px"}/1.55 var(--e-body)`, color: "var(--e-muted)", margin: "14px 0 0", maxWidth: "46ch" }}>
              {event.subtitle}
            </p>
          )}
          {meta}
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
              color: "var(--e-fg)",
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

function LineupList({
  entries,
  narrow,
  variant,
  theme,
}: {
  entries: EventRecord["lineup"];
  narrow: boolean;
  variant: string;
  theme: ReturnType<typeof categoryById>["theme"];
}) {
  // A lineup is a bill: the names are the product, so they are set at display
  // size and the roles stay quiet underneath.
  const big = variant === "poster" || variant === "neon";
  return (
    <div style={{ display: "grid", gap: 0 }}>
      {entries.map((e, i) => (
        <div
          key={e.id}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            padding: `${narrow ? 14 : 18}px 0`,
            borderTop: i ? `1px solid var(--e-line)` : "none",
          }}
        >
          {/* A billing position, drawn as one. Outlined rather than filled so a
              four-name bill does not turn into a column of loud numerals
              competing with the names they are indexing. */}
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: narrow ? 28 : 44,
              font: `700 ${narrow ? "18px" : big ? "30px" : "24px"}/1 var(--e-display)`,
              letterSpacing: theme.displayTracking,
              color: "transparent",
              WebkitTextStroke: `1px var(--e-accent)`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                font: `${big ? 700 : 600} ${narrow ? (big ? "20px" : "17px") : big ? "30px" : "20px"}/1.15 var(--e-display)`,
                letterSpacing: theme.displayTracking,
                textTransform: big ? "uppercase" : "none",
                color: "var(--e-fg)",
                margin: 0,
                overflowWrap: "anywhere",
              }}
            >
              {e.name}
            </p>
            {e.role && (
              <p style={{ font: "400 13px/1.4 var(--e-body)", color: "var(--e-muted)", margin: "5px 0 0" }}>{e.role}</p>
            )}
          </div>
          {e.at && (
            <p
              style={{
                font: "500 14px/1.2 var(--e-body)",
                color: "var(--e-accent-ink)",
                margin: 0,
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {e.at}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

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
            <p style={{ font: `600 ${narrow ? "15px" : "17px"}/1.35 var(--e-body)`, color: "var(--e-fg)", margin: 0, overflowWrap: "anywhere" }}>
              {e.name}
            </p>
            {e.role && (
              <p style={{ font: "400 13px/1.5 var(--e-body)", color: "var(--e-muted)", margin: "4px 0 0" }}>{e.role}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketTable({
  event,
  narrow,
  labels,
  theme,
}: {
  event: EventRecord;
  narrow: boolean;
  labels: Labels;
  theme: ReturnType<typeof categoryById>["theme"];
}) {
  return (
    <div style={{ display: "grid", gap: narrow ? 10 : 12 }}>
      {event.tiers.map((t) => {
        const left = t.quantity - t.sold;
        const out = left <= 0;
        // "Almost gone" is an absolute count, not a percentage: eight left is
        // eight left whether the room holds 60 or 4,000, and it is the number a
        // buyer decides on.
        const low = !out && left <= Math.max(10, Math.round(t.quantity * 0.08));
        return (
          <div
            key={t.id}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: narrow ? 12 : 24,
              padding: narrow ? "14px 16px" : "18px 22px",
              borderRadius: "var(--e-radius)",
              border: `1px solid var(--e-line)`,
              background: "var(--e-panel)",
              opacity: out ? 0.55 : 1,
              overflow: "hidden",
            }}
          >
            {/* A counterfoil is a ticket stub, so the ticket rows are stubs:
                a punched edge on the left and a perforated tear before the
                price. It is the one place the product's own name earns a
                motif, and it costs two pseudo-free gradients. */}
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
            <div style={{ minWidth: 0, flex: 1, paddingLeft: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p
                  style={{
                    font: `600 ${narrow ? "15px" : "17px"}/1.3 var(--e-body)`,
                    color: "var(--e-fg)",
                    margin: 0,
                    textDecoration: out ? "line-through" : "none",
                  }}
                >
                  {t.name}
                </p>
                {out ? (
                  <Badge tone="muted">{labels.soldOut}</Badge>
                ) : low ? (
                  <Badge tone="accent">{`${left} ${labels.left}`}</Badge>
                ) : null}
              </div>
              {t.description && (
                <p style={{ font: "400 13px/1.5 var(--e-body)", color: "var(--e-muted)", margin: "5px 0 0" }}>
                  {t.description}
                </p>
              )}
            </div>
            <span
              aria-hidden
              style={{
                alignSelf: "stretch",
                width: 1,
                flexShrink: 0,
                background: `repeating-linear-gradient(to bottom, var(--e-line) 0 4px, transparent 4px 9px)`,
              }}
            />
            <p
              style={{
                font: `600 ${narrow ? "16px" : "19px"}/1.2 var(--e-display)`,
                color: out ? "var(--e-muted)" : "var(--e-fg)",
                margin: 0,
                flexShrink: 0,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: theme.displayTracking,
                paddingLeft: narrow ? 0 : 4,
              }}
            >
              {t.price === 0 ? labels.free : formatMoney(t.price)}
            </p>
          </div>
        );
      })}
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

function Marquee({
  event,
  start,
  narrow,
}: {
  event: EventRecord;
  start: Date;
  narrow: boolean;
}) {
  const bits = [event.title, longDate(start), event.venueName].filter(Boolean);
  // Two identical runs, translated by exactly half the track, so the loop is
  // seamless without measuring anything at runtime.
  const run = (key: string) => (
    <span key={key} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      {[0, 1, 2, 3].map((r) =>
        bits.map((b, i) => (
          <span key={`${r}-${i}`} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
            <span
              style={{
                font: `600 ${narrow ? "13px" : "15px"}/1 var(--e-display)`,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--e-on-accent)",
                whiteSpace: "nowrap",
                padding: "0 18px",
              }}
            >
              {b}
            </span>
            <span
              aria-hidden
              style={{ width: 5, height: 5, borderRadius: 999, background: "var(--e-on-accent)", opacity: 0.55, flexShrink: 0 }}
            />
          </span>
        )),
      )}
    </span>
  );
  return (
    <div
      aria-hidden
      style={{
        overflow: "hidden",
        background: "var(--e-accent)",
        padding: narrow ? "9px 0" : "12px 0",
        borderTop: `1px solid var(--e-line)`,
        borderBottom: `1px solid var(--e-line)`,
      }}
    >
      <div style={{ display: "inline-flex", animation: "event-marquee 34s linear infinite", willChange: "transform" }}>
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
}

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

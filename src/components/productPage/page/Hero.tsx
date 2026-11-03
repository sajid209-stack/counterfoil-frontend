"use client";

import { contrast } from "@/lib/storefront/theme";
import { useState, type CSSProperties } from "react";
import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { calendarUrl } from "@/lib/events/calendar";
import { formatPriceShort } from "@/lib/format";
import { usePage, type PageCtx } from "./context";
import { canAddToCalendar, useHeroFacts, type HeroFact } from "./heroFacts";
import { buildTicketRows, priceSummary, usePrimaryLabel, useTicketUnit } from "./ticketRows";

/**
 * The hero: ONE component, three layouts chosen by the page's style
 * (docs/page-design.md).
 *
 *   cover      the title over a full-width photo, under a scrim that keeps it
 *              readable on any picture (an ornate dark one included)
 *   split      "Classic": the title and details beside the photo (phone and
 *              tablet: the photo first, then the text)
 *   editorial  "Title first": the title, then the details, then a wide photo
 *
 * Every layout carries the same things in the same order — title, tagline,
 * facts, countdown, the primary action with its price, add to calendar — so a
 * layout changes how the page is composed, never what it says. It lays out by
 * the width of the page's OWN box (`ctx.layout`), so the designer's phone
 * preview on a wide screen lays out as a phone.
 *
 * With no photo (none set, or it will not load) each layout has its own honest
 * fallback: split and editorial sit on a quiet panel with no picture frame,
 * cover becomes a panel hero in the page's colours. Never a stock glyph in a
 * grey box.
 */
export function Hero() {
  const ctx = usePage();
  const hero = ctx.style.hero;
  if (hero === "cover") return <CoverHero ctx={ctx} />;
  if (hero === "editorial") return <EditorialHero ctx={ctx} />;
  return <SplitHero ctx={ctx} />;
}

/* ── pieces shared by all three ──────────────────────────────────────────── */

/** The booking's picture: the page's cover, else its first photo, else nothing. */
const mediaUrl = (ctx: PageCtx): string | null => ctx.page.coverUrl || ctx.product.images[0]?.url || null;

/** The picture to draw, or null when there is none or it failed to load. */
function usePhoto(ctx: PageCtx): { url: string | null; onError: () => void } {
  const url = mediaUrl(ctx);
  const [failed, setFailed] = useState<string | null>(null);
  return { url: url && failed !== url ? url : null, onError: () => setFailed(url) };
}

/** A long name steps down a size so it stays within about two lines. */
function titleStyle(ctx: PageCtx): CSSProperties {
  const phone = ctx.layout === "phone";
  const long = ctx.ev.title.length > 52;
  if (ctx.look.titleCaps) {
    return {
      textTransform: "uppercase",
      fontSize: long ? (phone ? 36 : 46) : phone ? 44 : 56,
      lineHeight: long ? (phone ? "40px" : "50px") : phone ? "48px" : "60px",
    };
  }
  if (long) return { fontSize: phone ? 30 : 40, lineHeight: phone ? "36px" : "48px" };
  return {};
}

/** A small chip in secondary colours (docs/page-style.md §5 "words"): the one
 *  place the secondary colour is required to show on the hero. */
function Badge({ ctx, onPhoto }: { ctx: PageCtx; onPhoto?: boolean }) {
  const text = ctx.style.badge;
  if (!text) return null;
  return (
    <span
      className="inline-flex max-w-fit items-center self-start rounded-full px-3 py-1 text-[13px] font-semibold leading-5"
      style={onPhoto ? { background: "rgb(255 255 255 / 0.16)", color: "#fff" } : { background: "var(--ps-secondary-soft)", color: "var(--ps-secondary-ink)" }}
    >
      {text}
    </span>
  );
}

function Title({ ctx }: { ctx: PageCtx }) {
  return (
    <h1 className="pg-title" style={titleStyle(ctx)}>
      {ctx.ev.title}
    </h1>
  );
}

function FactsRow({ facts, onPhoto }: { facts: HeroFact[]; onPhoto?: boolean }) {
  if (facts.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2" style={{ color: onPhoto ? "rgb(255 255 255 / 0.92)" : "var(--pg-fg)" }}>
      {facts.map((f) => (
        <li key={f.id} className="flex min-w-0 items-center gap-2 text-[15px] font-medium leading-[22px]">
          <f.icon size={18} strokeWidth={1.75} aria-hidden className="shrink-0" style={{ color: onPhoto ? "rgb(255 255 255 / 0.75)" : "var(--pg-muted)" }} />
          <span className="min-w-0">{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Starts in 12 days 04 hours 30 mins" as one compact row, not a band. */
function CountdownRow({ ctx, onPhoto }: { ctx: PageCtx; onPhoto?: boolean }) {
  const c = ctx.countdown;
  if (!c) return null;
  const ms = c.at.getTime() - ctx.now.getTime();
  if (ms <= 0) return null;
  const parts = [
    { v: Math.floor(ms / 86400000), l: ctx.labels.countdownDays },
    { v: Math.floor((ms % 86400000) / 3600000), l: ctx.labels.countdownHours },
    { v: Math.floor((ms % 3600000) / 60000), l: ctx.labels.countdownMins },
  ];
  return (
    <div
      role="timer"
      aria-label={`${c.label} ${parts.map((p) => `${p.v} ${p.l}`).join(" ")}`}
      className="inline-flex max-w-full flex-wrap items-center gap-x-4 gap-y-1 self-start rounded-full px-4 py-2 text-[14px] leading-5"
      style={{
        background: onPhoto ? "rgb(255 255 255 / 0.14)" : "var(--pg-soft)",
        color: onPhoto ? "#fff" : "var(--pg-fg)",
      }}
    >
      <span className="font-medium" style={{ color: onPhoto ? "rgb(255 255 255 / 0.85)" : "var(--pg-muted)" }}>
        {c.label}
      </span>
      {parts.map((p) => (
        <span key={p.l} className="tnum whitespace-nowrap">
          <b className="text-[16px] font-semibold">{String(p.v).padStart(2, "0")}</b> <span className="text-[13px]">{p.l}</span>
        </span>
      ))}
    </div>
  );
}

/** The primary action with its price beside it, and add to calendar when the
 *  page has a date. */
function Actions({ ctx, onPhoto }: { ctx: PageCtx; onPhoto?: boolean }) {
  const t = useTranslations("storefront");
  const unitOf = useTicketUnit(ctx.product);
  const rows = buildTicketRows(ctx);
  const sum = priceSummary(rows);
  const price = sum.price;
  const noTickets = rows.length === 0;
  const canBook = noTickets || price !== null;
  const label = usePrimaryLabel(ctx);
  const unit = price !== null ? unitOf(sum.pt, price) : "";

  /* Always the page's own colour: it is the one thing the operator chose for the
     button. Only a near-black accent would sink into the scrim, and turns white. */
  const sinks = onPhoto && contrast(ctx.style.colours.fill, "#111114") < 3;
  const ctaStyle: CSSProperties | undefined = sinks ? { background: "#fff", color: "#111114" } : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" className="pg-btn" style={ctaStyle} disabled={!canBook} onClick={() => ctx.book()}>
          {label}
        </button>
        {price !== null ? (
          <div className="flex flex-col leading-tight" style={{ color: onPhoto ? "#fff" : "var(--pg-fg)" }}>
            {price > 0 && sum.many && (
              <span className="text-[13px] font-medium" style={{ color: onPhoto ? "rgb(255 255 255 / 0.8)" : "var(--pg-muted)" }}>
                {ctx.style.priceLabel ?? ctx.labels.from}
              </span>
            )}
            <span className="tnum text-[22px] font-bold leading-7">
              {price === 0 ? ctx.labels.free : formatPriceShort(price)}
              {unit && (
                <span className="ml-1.5 text-[14px] font-medium" style={{ color: onPhoto ? "rgb(255 255 255 / 0.8)" : "var(--pg-muted)" }}>
                  {unit}
                </span>
              )}
            </span>
            {sum.freeToo && (
              <span className="text-[13px]" style={{ color: onPhoto ? "rgb(255 255 255 / 0.8)" : "var(--pg-muted)" }}>
                {t("pg.shell.freeToo")}
              </span>
            )}
          </div>
        ) : (
          !noTickets && (
            <span className="text-[16px] font-semibold" style={{ color: onPhoto ? "#fff" : "var(--pg-fg)" }}>
              {sum.allEnded ? t("pg.shell.salesEnded") : ctx.labels.soldOut}
            </span>
          )
        )}
      </div>
      {canAddToCalendar(ctx) && <CalendarLink ctx={ctx} onPhoto={onPhoto} />}
    </div>
  );
}

function CalendarLink({ ctx, onPhoto }: { ctx: PageCtx; onPhoto?: boolean }) {
  return (
    <a
      href={ctx.inert ? undefined : calendarUrl(ctx.ev)}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={ctx.inert || undefined}
      onClick={(e) => ctx.inert && e.preventDefault()}
      className="inline-flex min-h-11 items-center gap-2 self-start text-[14px] font-medium underline-offset-4 hover:underline"
      style={{ color: onPhoto ? "#fff" : "var(--pg-ink)" }}
    >
      <CalendarPlus size={18} strokeWidth={1.75} aria-hidden />
      {ctx.labels.addToCalendar}
    </a>
  );
}

type Photo = ReturnType<typeof usePhoto>;

/** The photo, or nothing. The frame follows the page's media radius. */
function Picture({ photo, aspect }: { photo: Photo; aspect: string }) {
  if (!photo.url) return null;
  return (
    <div className="pg-media relative w-full overflow-hidden" style={{ aspectRatio: aspect, background: "var(--pg-surface)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled/local assets; next/image loader config avoided by design (see sf.tsx) */}
      <img src={photo.url} alt="" onError={photo.onError} className="absolute inset-0 h-full w-full object-cover" />
    </div>
  );
}

/** The hero's ground when there is no photo to carry it: a quiet panel in the
 *  page's own colours, full width, with a hairline under it. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <header className={className} style={{ background: "var(--pg-surface)", borderBottom: "1px solid var(--pg-line)" }}>
      {children}
    </header>
  );
}

/** The text of the hero, in one column. */
function Body({ ctx, facts, wide }: { ctx: PageCtx; facts: HeroFact[]; wide?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Badge ctx={ctx} />
      <Title ctx={ctx} />
      {ctx.ev.subtitle && <p className={`pg-body pg-muted ${wide ? "max-w-[60ch]" : "max-w-[56ch]"}`}>{ctx.ev.subtitle}</p>}
      <FactsRow facts={facts} />
      <CountdownRow ctx={ctx} />
      <Actions ctx={ctx} />
    </div>
  );
}

/* ── split ("Classic") ───────────────────────────────────────────────────── */

function SplitHero({ ctx }: { ctx: PageCtx }) {
  const facts = useHeroFacts(ctx);
  const photo = usePhoto(ctx);
  const side = ctx.layout === "desktop";
  const body = <Body ctx={ctx} facts={facts} />;

  if (!photo.url) {
    return (
      <Panel>
        <div className="pg-container py-8 md:py-12">
          <div className="max-w-[760px]">{body}</div>
        </div>
      </Panel>
    );
  }
  return (
    <header className="pg-container pb-8 pt-5 md:pb-12 md:pt-8">
      {side ? (
        <div className="grid items-center gap-12" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          {body}
          <Picture photo={photo} aspect="4 / 3" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Picture photo={photo} aspect={ctx.layout === "tablet" ? "2 / 1" : "16 / 10"} />
          {body}
        </div>
      )}
    </header>
  );
}

/* ── editorial ("Title first") ───────────────────────────────────────────── */

function EditorialHero({ ctx }: { ctx: PageCtx }) {
  const facts = useHeroFacts(ctx);
  const photo = usePhoto(ctx);
  const desktop = ctx.layout === "desktop";

  /* Desktop: the title and tagline lead on the left; the details (facts,
     countdown, the action) sit in a narrower column on the right, level with
     the foot of the title. Narrower screens stack them in that order. */
  const lead = (
    <div className="flex min-w-0 flex-col gap-5">
      <Badge ctx={ctx} />
      <Title ctx={ctx} />
      {ctx.ev.subtitle && <p className="pg-body pg-muted max-w-[60ch]">{ctx.ev.subtitle}</p>}
    </div>
  );
  const details = (
    <div className="flex min-w-0 flex-col gap-5">
      <FactsRow facts={facts} />
      <CountdownRow ctx={ctx} />
      <Actions ctx={ctx} />
    </div>
  );
  const top = desktop ? (
    <div className="grid items-end gap-14" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
      {lead}
      {details}
    </div>
  ) : (
    <div className="flex max-w-[920px] flex-col gap-5">
      {lead}
      {details}
    </div>
  );
  const inner = (
    <div className="pg-container pb-8 pt-8 md:pb-12 md:pt-12">
      {top}
      {photo.url && (
        <div className="mt-8 md:mt-10">
          <Picture photo={photo} aspect={ctx.layout === "phone" ? "16 / 10" : "21 / 9"} />
        </div>
      )}
    </div>
  );
  return photo.url ? <header>{inner}</header> : <Panel>{inner}</Panel>;
}

/* ── cover ───────────────────────────────────────────────────────────────── */

function CoverHero({ ctx }: { ctx: PageCtx }) {
  const facts = useHeroFacts(ctx);
  const photo = usePhoto(ctx);
  const phone = ctx.layout === "phone";

  /* No photo: a cover with nothing to cover is the same text on the page's own
     panel, not a black slab. */
  if (!photo.url) {
    return (
      <Panel>
        <div className="pg-container py-10 md:py-16">
          <div className="max-w-[860px]">
            <Body ctx={ctx} facts={facts} wide />
          </div>
        </div>
      </Panel>
    );
  }

  /* The scrim is the black (or the dark page's own ground) at no less than
     ~50% everywhere and deepest under the text, so white type reads on an
     ornate or bright picture and no seam shows against a dark page. */
  const base = ctx.look.mode === "dark" ? "13 13 16" : "0 0 0";
  return (
    <header className="pg-on-photo relative isolate overflow-hidden text-white" style={{ minHeight: phone ? 420 : ctx.layout === "tablet" ? 480 : 540 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled/local assets; next/image loader config avoided by design (see sf.tsx) */}
      <img src={photo.url} alt="" onError={photo.onError} className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(to top, rgb(${base} / 0.9) 0%, rgb(${base} / 0.72) 42%, rgb(${base} / 0.38) 74%, rgb(${base} / 0.18) 100%)`,
        }}
      />
      <div className="pg-container flex items-end" style={{ minHeight: "inherit" }}>
        <div className="flex max-w-[860px] flex-col gap-4 pb-8 pt-24 md:gap-5 md:pb-12" style={{ textShadow: "0 1px 14px rgb(0 0 0 / 0.5)" }}>
          <Badge ctx={ctx} onPhoto />
          <Title ctx={ctx} />
          {ctx.ev.subtitle && (
            <p className="pg-body max-w-[56ch]" style={{ color: "rgb(255 255 255 / 0.92)" }}>
              {ctx.ev.subtitle}
            </p>
          )}
          <FactsRow facts={facts} onPhoto />
          <CountdownRow ctx={ctx} onPhoto />
          <div style={{ textShadow: "none" }}>
            <Actions ctx={ctx} onPhoto />
          </div>
        </div>
      </div>
    </header>
  );
}

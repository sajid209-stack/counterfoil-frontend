"use client";

import { useState, type CSSProperties } from "react";
import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { TypeIcon } from "@/app/s/_components/sf";
import { calendarUrl } from "@/lib/events/calendar";
import { formatPriceShort } from "@/lib/format";
import { usePage, type PageCtx } from "./context";
import { canAddToCalendar, useHeroFacts, type HeroFact } from "./heroFacts";
import { buildTicketRows, priceSummary, usePrimaryLabel, useTicketUnit } from "./ticketRows";

/**
 * The hero: ONE component, three treatments chosen by the look
 * (docs/product-page.md §3.3).
 *
 *   split      text left, media right at 4:3 (phone: media first, 16:10)
 *   cover      a full-bleed photo under a bottom scrim, text bottom-left in white
 *   editorial  the title first in the display face, a meta line, a wide photo
 *
 * Every treatment carries the same things in the same order — title, tagline,
 * facts, countdown, the primary action with its price, add to calendar — so a
 * look changes how the page is composed, never what it says. It lays out by the
 * width of the page's OWN box (`ctx.layout`), so the designer's phone preview
 * on a wide screen lays out as a phone.
 */
export function Hero() {
  const ctx = usePage();
  const hero = ctx.look.hero;
  if (hero === "cover") return <CoverHero ctx={ctx} />;
  if (hero === "editorial") return <EditorialHero ctx={ctx} />;
  return <SplitHero ctx={ctx} />;
}

/* ── pieces shared by all three ──────────────────────────────────────────── */

/** The booking's picture: the page's cover, else its first photo, else nothing. */
const mediaUrl = (ctx: PageCtx): string | null => ctx.page.coverUrl || ctx.product.images[0]?.url || null;

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

  /* On a photo a light page's accent-dark fill would sink into the scrim, so the
     button turns white there; a dark look's fill already stands off its ground. */
  const photoLightLook = onPhoto && ctx.look.mode === "light";
  const ctaStyle: CSSProperties | undefined = photoLightLook ? { background: "#fff", color: "#111114" } : undefined;

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
                {ctx.labels.from}
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

/** A photo, or — when there is none, or it will not load — a calm surface panel
 *  carrying the booking's own glyph. No stripes, no initials, no pattern. */
function Picture({ ctx, aspect, className }: { ctx: PageCtx; aspect: string; className?: string }) {
  const url = mediaUrl(ctx);
  const [broken, setBroken] = useState(false);
  const showImg = !!url && !broken;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[16px] ${className ?? ""}`}
      style={{ aspectRatio: aspect, background: "var(--pg-surface)", border: showImg ? undefined : "1px solid var(--pg-line)" }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- bundled/local assets; next/image loader config avoided by design (see sf.tsx)
        <img src={url} alt="" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full"
            style={{ background: "var(--pg-card)", color: "var(--pg-ink)", border: "1px solid var(--pg-line)" }}
          >
            <TypeIcon bookingType={ctx.product.bookingType} size={44} />
          </span>
        </div>
      )}
    </div>
  );
}

/* ── split ───────────────────────────────────────────────────────────────── */

function SplitHero({ ctx }: { ctx: PageCtx }) {
  const facts = useHeroFacts(ctx);
  const side = ctx.layout === "desktop";
  const body = (
    <div className="flex min-w-0 flex-col gap-5">
      <Title ctx={ctx} />
      {ctx.ev.subtitle && <p className="pg-body pg-muted max-w-[56ch]">{ctx.ev.subtitle}</p>}
      <FactsRow facts={facts} />
      <CountdownRow ctx={ctx} />
      <Actions ctx={ctx} />
    </div>
  );
  return (
    <header className="pg-container pb-8 pt-5 md:pb-12 md:pt-8">
      {side ? (
        <div className="grid items-center gap-12" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          {body}
          <Picture ctx={ctx} aspect="4 / 3" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Picture ctx={ctx} aspect={ctx.layout === "tablet" ? "2 / 1" : "16 / 10"} />
          {body}
        </div>
      )}
    </header>
  );
}

/* ── editorial ───────────────────────────────────────────────────────────── */

function EditorialHero({ ctx }: { ctx: PageCtx }) {
  const facts = useHeroFacts(ctx);
  return (
    <header className="pg-container pb-8 pt-8 md:pb-12 md:pt-12">
      <div className="flex max-w-[920px] flex-col gap-5">
        <Title ctx={ctx} />
        <FactsRow facts={facts} />
        {ctx.ev.subtitle && <p className="pg-body pg-muted max-w-[60ch]">{ctx.ev.subtitle}</p>}
        <CountdownRow ctx={ctx} />
        <Actions ctx={ctx} />
      </div>
      <Picture ctx={ctx} aspect={ctx.layout === "phone" ? "16 / 10" : "21 / 9"} className="mt-8 md:mt-10" />
    </header>
  );
}

/* ── cover ───────────────────────────────────────────────────────────────── */

function CoverHero({ ctx }: { ctx: PageCtx }) {
  const facts = useHeroFacts(ctx);
  const url = mediaUrl(ctx);
  const [broken, setBroken] = useState(false);
  const phone = ctx.layout === "phone";
  const showImg = !!url && !broken;
  /* The scrim ends in the page's own ground, so no seam shows under the hero. */
  const base = ctx.look.mode === "dark" ? "13 13 16" : "0 0 0";
  return (
    <header className="pg-on-photo relative isolate overflow-hidden text-white" style={{ minHeight: phone ? 400 : ctx.layout === "tablet" ? 460 : 500 }}>
      {/* The ground: a photo, or one dark colour with a single soft accent light. */}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- bundled/local assets; next/image loader config avoided by design (see sf.tsx)
        <img src={url} alt="" onError={() => setBroken(true)} className="absolute inset-0 -z-20 h-full w-full object-cover" />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{
            background:
              "radial-gradient(ellipse 55% 75% at 88% 8%, color-mix(in srgb, var(--pg-accent) 30%, transparent), transparent 70%), #0d0d10",
          }}
        />
      )}
      {/* The scrim: dark enough under the text to read it on any photo. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: showImg
            ? `linear-gradient(to top, rgb(${base} / 0.92) 0%, rgb(${base} / 0.8) 45%, rgb(${base} / 0.62) 72%, rgb(${base} / 0.28) 100%)`
            : undefined,
        }}
      />
      <div className="pg-container flex items-end" style={{ minHeight: "inherit" }}>
        <div className="flex max-w-[860px] flex-col gap-4 pb-8 pt-24 md:gap-5 md:pb-12" style={{ textShadow: "0 1px 14px rgb(0 0 0 / 0.45)" }}>
          <Title ctx={ctx} />
          {ctx.ev.subtitle && (
            <p className="pg-body max-w-[56ch]" style={{ color: "rgb(255 255 255 / 0.9)" }}>
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

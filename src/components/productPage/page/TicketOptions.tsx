"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { isBundleTier, spansDays } from "@/lib/api/events";
import { formatDay, formatPriceShort } from "@/lib/format";
import { cellStyle, evenPlan, gridStyle } from "./bento";
import { usePage, type PageCtx } from "./context";
import { Section } from "./Section";
import { buildTicketRows, hasTicketOptions, useTicketUnit, type TicketChip, type TicketRow } from "./ticketRows";

const MAX_PERKS = 4;

/**
 * The ticket options section (docs/product-page.md §3.4): one `TicketOption`
 * card per ticket type, the same anatomy on every page —
 *
 *   name + state chip · description · what's included · days · price + Choose
 *
 * in a two-column grid (one on a phone), cards in a row the same height with
 * the price pinned to the foot. Drawn only where there is something to choose
 * between: two or more ticket types, or an on-a-date booking. A court by the
 * hour is one decision and the booking panel is the whole of it.
 *
 * Choose opens the booking with that ticket already chosen (`ctx.book(id)`).
 *
 * One flow, one strong action. With the booking panel beside the page the cards
 * are the reference — what each ticket includes — and the panel is where the
 * choice is made, so a card's Choose is a quiet link that hands the ticket to
 * the panel, and the price is a figure, not a headline. Where the cards ARE the
 * way in (phone, tablet: the sheet), Choose is a real button.
 */
export function TicketOptions() {
  const ctx = usePage();
  if (!hasTicketOptions(ctx)) return null;
  return (
    <Section id="tickets" title={ctx.labels.tickets}>
      <Cards ctx={ctx} />
    </Section>
  );
}

function Cards({ ctx }: { ctx: PageCtx }) {
  const rows = buildTicketRows(ctx);
  const unitOf = useTicketUnit(ctx.product);
  const plan = evenPlan(rows.length, ctx.layout);
  return (
    <ul style={{ ...gridStyle(plan), gap: "var(--pg-gap, 16px)" }} aria-label={ctx.labels.tickets}>
      {rows.map((row, i) => (
        <li key={row.id} className="flex min-w-0" style={cellStyle(plan.cells[i])}>
          <TicketOption ctx={ctx} row={row} unit={unitOf(row.pt, row.state.tier.price)} wide={plan.columns === 6 && plan.cells[i].col === 6} />
        </li>
      ))}
    </ul>
  );
}

function StateChip({ chip }: { chip: TicketChip }) {
  const t = useTranslations("storefront");
  const { labels } = usePage();
  const text =
    chip === "soldOut" ? labels.soldOut : chip === "ended" ? t("pg.shell.salesEnded") : chip === "lastFew" ? t("pg.shell.lastFew") : labels.mostPopular;
  const style =
    chip === "popular"
      ? { background: "var(--pg-soft)", color: "var(--pg-ink)" }
      : chip === "lastFew"
        ? { background: "var(--pg-soft)", color: "var(--pg-fg)" }
        : { background: "var(--pg-surface)", color: "var(--pg-muted)", border: "1px solid var(--pg-line)" };
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold" style={style}>
      {text}
    </span>
  );
}

function TicketOption({ ctx, row, unit, wide }: { ctx: PageCtx; row: TicketRow; unit: string; wide: boolean }) {
  const t = useTranslations("storefront");
  const { ev, labels } = ctx;
  const { state, pt, chip, gone } = row;
  const tier = state.tier;
  const perks = (tier.perks ?? []).filter(Boolean);
  const shownPerks = perks.slice(0, MAX_PERKS);
  const morePerks = perks.length - shownPerks.length;
  const multi = spansDays(ev);
  const bundle = multi && isBundleTier(ev, tier);
  const priceText = tier.price === 0 ? labels.free : pt?.donation ? t("donationFrom", { price: formatPriceShort(tier.price) }) : formatPriceShort(tier.price);
  const saving = bundle && state.saving ? labels.saves.replace("{amount}", formatPriceShort(state.saving)) : null;
  const muted = "var(--pg-muted)";
  /* Beside the booking panel the card is a reference, not a second picker. */
  const quiet = ctx.layout === "desktop";

  return (
    <article
      className={`pg-card flex w-full min-w-0 p-5 ${wide ? "flex-row items-center gap-8" : "flex-col"}`}
      style={gone ? { background: "var(--pg-surface)" } : undefined}
    >
      <div className={wide ? "flex min-w-0 flex-1 flex-col" : "contents"}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-[16px] font-semibold leading-6" style={{ color: gone ? muted : "var(--pg-fg)" }}>
          {tier.name}
        </h3>
        {chip && <StateChip chip={chip} />}
      </div>

      {tier.description && (
        <p className="mt-1 line-clamp-2 text-[14px] leading-5" style={{ color: muted }}>
          {tier.description}
        </p>
      )}

      {shownPerks.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" style={{ color: gone ? muted : "var(--pg-fg)" }}>
          {shownPerks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[14px] leading-5">
              <Check size={16} strokeWidth={2.25} aria-hidden className="mt-0.5 shrink-0" style={{ color: gone ? muted : "var(--pg-ink)" }} />
              <span className="min-w-0">{p}</span>
            </li>
          ))}
          {morePerks > 0 && (
            <li className="pl-6 text-[13px] font-medium leading-5" style={{ color: muted }}>
              {t("pg.shell.moreCount", { count: morePerks })}
            </li>
          )}
        </ul>
      )}

      {multi && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bundle ? (
            <span className="pg-chip">{t("pg.shell.allDaysN", { count: state.days.length })}</span>
          ) : (
            state.days.map((d) => (
              <span key={d.id} className="pg-chip">
                {formatDay(d.date, { weekday: true })}
              </span>
            ))
          )}
          {saving && (
            <span className="pg-chip" style={{ background: "var(--pg-soft)", fontWeight: 600 }}>
              {saving}
            </span>
          )}
        </div>
      )}

      </div>

      <div className={wide ? "flex shrink-0 items-center gap-6" : "mt-auto flex items-end justify-between gap-3 pt-5"}>
        <div className="min-w-0">
          <p
            className={`tnum font-semibold ${quiet ? "text-[18px] leading-6" : "text-[22px] leading-7"}`}
            style={{ color: gone ? muted : "var(--pg-fg)", textDecoration: gone && tier.price > 0 ? "line-through" : undefined }}
          >
            {priceText}
          </p>
          {(unit || pt?.ageNote) && (
            <p className="text-[13px] leading-[18px]" style={{ color: muted }}>
              {[unit, pt?.ageNote].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {!gone && (
          <button
            type="button"
            className={quiet ? "inline-flex min-h-11 shrink-0 items-center rounded-[var(--ps-radius-control,12px)] px-2 text-[14px] font-semibold underline-offset-4 hover:underline" : "pg-btn-secondary shrink-0"}
            style={quiet ? { color: "var(--pg-ink)" } : { minHeight: 44 }}
            aria-label={t("pg.shell.chooseNamed", { name: tier.name })}
            onClick={() => ctx.book(tier.id)}
          >
            {t("pg.shell.choose")}
          </button>
        )}
      </div>
    </article>
  );
}

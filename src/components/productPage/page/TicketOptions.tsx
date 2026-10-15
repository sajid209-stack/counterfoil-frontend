"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { isBundleTier, spansDays } from "@/lib/api/events";
import { formatDay, formatPriceShort } from "@/lib/format";
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
  return (
    <ul
      className="grid gap-4"
      style={{ gridTemplateColumns: ctx.layout === "phone" ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))" }}
      aria-label={ctx.labels.tickets}
    >
      {rows.map((row) => (
        <li key={row.id} className="flex min-w-0">
          <TicketOption ctx={ctx} row={row} unit={unitOf(row.pt, row.state.tier.price)} />
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
      ? { background: "var(--pg-fill)", color: "var(--pg-on-fill)" }
      : chip === "lastFew"
        ? { background: "var(--pg-soft)", color: "var(--pg-fg)" }
        : { background: "var(--pg-surface)", color: "var(--pg-muted)", border: "1px solid var(--pg-line)" };
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold" style={style}>
      {text}
    </span>
  );
}

function TicketOption({ ctx, row, unit }: { ctx: PageCtx; row: TicketRow; unit: string }) {
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

  return (
    <article
      className="flex w-full min-w-0 flex-col rounded-[16px] p-5"
      style={{
        background: gone ? "var(--pg-surface)" : "var(--pg-card)",
        border: `1px solid ${row.chip === "popular" ? "var(--pg-accent)" : "var(--pg-line)"}`,
      }}
    >
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

      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p
            className="tnum text-[22px] font-bold leading-7"
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
            className="pg-btn-secondary shrink-0"
            style={{ minHeight: 44 }}
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

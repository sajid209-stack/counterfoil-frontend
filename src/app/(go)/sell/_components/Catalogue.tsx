"use client";

/* ── What the till can sell ────────────────────────────────────────────────
 *
 * The same wall as the v1 till — search, groups, and a card per booking with
 * its live state — extracted here as its own component because in v2 it has
 * two homes: the left column on a tablet, where it is always open, and a
 * section of the scroll on a phone, where it folds away once the sale has
 * something in it.
 *
 * That fold is the one behavioural difference. On a phone a grid of twenty
 * bookings between the top of the page and the sale is a screenful of
 * scrolling to check what you just added, which is exactly the trip the cart
 * used to be.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { ProductThumb } from "@/components/ui";
import type { Product, Resource, Staff } from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { posLiveState } from "@/lib/posState";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay, formatPriceShort } from "@/lib/format";

export function Catalogue({
  products,
  resources,
  team,
  currency,
  query,
  onQuery,
  onPick,
  onCustom,
  loading,
}: {
  products: Product[];
  resources: Resource[];
  team: Staff[];
  currency: string;
  query: string;
  onQuery: (q: string) => void;
  onPick: (p: Product) => void;
  onCustom: () => void;
  loading: boolean;
}) {
  const t = useTranslations("sell");
  const tp = useTranslations("pos");

  // Field passes issue from Quick pass, not from the wall.
  const sellable = useMemo(() => products.filter((p) => p.bookingType !== "BT-14"), [products]);

  /* Catalogue groups are gone, so the wall is everything sellable narrowed by
     the search box alone. */
  const shown = sellable.filter((p) => {
    const q = query.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  const liveWords = useMemo(
    () => ({
      soldOutToday: tp("live.soldOutToday"),
      noneLeftToday: tp("live.noneLeftToday"),
      busyNow: tp("live.busyNow"),
      leftOfTotal: (left: number, total: number) => tp("live.leftOfTotal", { left, total }),
      nextAt: (time: string, left: number) => tp("live.nextAt", { time, left }),
      freeOfTotal: (free: number, total: number) => tp("live.freeOfTotal", { free, total }),
      startsOn: (d: string) => tp("live.startsOn", { date: formatDay(d) }),
      nextDay: (d: string, time: string) => tp("live.nextDay", { day: formatDay(d, { weekday: true }), time }),
      providersFree: (free: number, total: number) => tp("live.providersFree", { free, total }),
    }),
    [tp],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-comfortable">
      <div data-focus-host className="go-surface flex h-[52px] min-w-0 items-center gap-tight rounded-full px-section focus-within:ring-2 focus-within:ring-inset focus-within:ring-ember">
        <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("catalogue.searchPlaceholder")}
          className="h-full w-full bg-transparent text-sm outline-none focus-visible:outline-none placeholder:text-faint"
        />
        {query && (
          <button type="button" onClick={() => onQuery("")} className="text-[0.8125rem] text-muted hover:text-fg">
            {t("catalogue.clear")}
          </button>
        )}
      </div>


      <div className="min-w-0">
        {loading ? (
          <div aria-busy="true" className="flex animate-pulse flex-col gap-tight p-section">
            <div className="h-4 w-1/3 rounded-go-sm bg-line" />
            <div className="h-4 w-2/3 rounded-go-sm bg-line" />
            <div className="h-4 w-1/2 rounded-go-sm bg-line" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-comfortable sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => {
              const live = posLiveState(p, DEMO_TODAY, 12 * 60, liveWords);
              const from = Math.min(
                ...p.tiers
                  .filter((x) => x.active)
                  .map((x) => x.price)
                  .concat(p.sections?.map((s) => s.price) ?? [])
                  .concat([Infinity]),
              );
              return (
                <div
                  key={p.id}
                  data-focus-host
                  className="go-surface flex overflow-hidden transition-shadow duration-quick hover:shadow-md focus-within:ring-2 focus-within:ring-inset focus-within:ring-ember active:scale-[0.99]"
                >
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className="flex min-w-0 flex-1 flex-col gap-comfortable p-comfortable text-left transition-colors duration-quick active:bg-ember/10"
                  >
                    <span className="flex w-full items-start justify-between gap-tight">
                      <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="card" />
                      {live && live.tone !== "ok" && (
                        <span
                          className={`shrink-0 whitespace-nowrap rounded-full px-tight py-inline text-[0.75rem] font-medium ${live.tone === "none" ? "bg-danger/10 text-danger" : "bg-ember/15 text-brand-foreground"}`}
                        >
                          {live.tone === "none" ? tp("sheet.soldOut") : tp("live.limited")}
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-3 text-[0.9375rem] font-semibold leading-snug">{p.name}</span>
                      <span className="mt-inline text-[1.25rem] font-bold leading-none text-ember">
                        {formatPriceShort(from, currency)}
                      </span>
                      <span className="mt-tight line-clamp-2 text-[0.8125rem] leading-tight text-muted">
                        {behaviourSubtitle(p, { resources, team })}
                      </span>
                      {live && (
                        <span
                          className={`mt-inline flex items-center gap-inline text-[0.8125rem] leading-tight ${live.tone === "none" ? "text-danger" : live.tone === "low" ? "font-medium text-brand-foreground" : "text-success"}`}
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                          <span className="min-w-0 truncate">{live.text}</span>
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={onCustom}
              className="flex min-h-[140px] flex-col items-center justify-center gap-tight rounded-go border border-dashed border-strong text-muted transition-colors duration-quick hover:bg-muted-wash active:bg-ember/10"
            >
              <Plus size={20} strokeWidth={1.5} />
              <span className="text-[0.8125rem]">{t("catalogue.custom")}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

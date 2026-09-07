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
import type { Category, Product, Resource, Staff } from "@/lib/api";
import { behaviourSubtitle } from "@/lib/behaviour";
import { posLiveState } from "@/lib/posState";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay, formatPriceShort } from "@/lib/format";

/** The nine selection systems, offered beside the operator's own groups. A
 *  category says what a thing IS; this says how it is SOLD. */
const SYSTEMS = [
  { id: "sys:BT-01", bt: "BT-01", key: "sysOpenEntry" },
  { id: "sys:BT-02", bt: "BT-02", key: "sysDatePass" },
  { id: "sys:BT-03", bt: "BT-03", key: "sysSessions" },
  { id: "sys:BT-04", bt: "BT-04", key: "sysTimeSlots" },
  { id: "sys:BT-05", bt: "BT-05", key: "sysByDuration" },
  { id: "sys:BT-06", bt: "BT-06", key: "sysDailyLimit" },
  { id: "sys:BT-07", bt: "BT-07", key: "sysSeats" },
  { id: "sys:BT-09", bt: "BT-09", key: "sysGuided" },
  { id: "sys:BT-10", bt: "BT-10", key: "sysAppointments" },
] as const;

export function Catalogue({
  products,
  categories,
  resources,
  team,
  currency,
  query,
  onQuery,
  category,
  onCategory,
  onPick,
  onCustom,
  loading,
}: {
  products: Product[];
  categories: Category[];
  resources: Resource[];
  team: Staff[];
  currency: string;
  query: string;
  onQuery: (q: string) => void;
  category: string;
  onCategory: (id: string) => void;
  onPick: (p: Product) => void;
  onCustom: () => void;
  loading: boolean;
}) {
  const t = useTranslations("sell");
  const tp = useTranslations("pos");

  // Field passes issue from Quick pass, not from the wall.
  const sellable = useMemo(() => products.filter((p) => p.bookingType !== "BT-14"), [products]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";

  // A chip that filters to nothing is a control that tells the cashier they
  // made a mistake, so both chip rows are built from the sellable catalogue
  // rather than from the already-filtered grid.
  const chipCategories = categories
    .filter((c) => c.active !== false && sellable.some((p) => p.categoryId === c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const chipSystems = SYSTEMS.filter((x) => sellable.some((p) => p.bookingType === x.bt));

  const shown = sellable
    .filter((p) =>
      category === "all"
        ? true
        : category.startsWith("sys:")
          ? p.bookingType === category.slice(4)
          : p.categoryId === category,
    )
    .filter((p) => {
      const q = query.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q) || catName(p.categoryId).toLowerCase().includes(q);
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
          <button type="button" onClick={() => onQuery("")} className="text-[13px] text-faint hover:text-fg">
            {t("catalogue.clear")}
          </button>
        )}
      </div>

      <div className="-mx-comfortable flex snap-x snap-mandatory gap-tight overflow-x-auto px-comfortable py-inline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[{ id: "all", name: t("catalogue.all") }, ...chipCategories].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCategory(c.id)}
            className={`h-11 min-w-11 shrink-0 snap-start rounded-full px-section text-sm shadow-go transition-colors duration-quick ${category === c.id ? "bg-ember font-medium text-white" : "bg-card text-muted active:bg-subtle"}`}
          >
            {c.name}
          </button>
        ))}
        {chipSystems.length > 0 && (
          <>
            <span aria-hidden className="mx-tight my-inline w-px shrink-0 self-stretch bg-line" />
            <span className="flex shrink-0 items-center pr-tight text-[13px] font-medium uppercase tracking-wide text-muted">
              {t("catalogue.systems")}
            </span>
            {chipSystems.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => onCategory(x.id)}
                className={`h-11 min-w-11 shrink-0 snap-start whitespace-nowrap rounded-full px-section text-sm shadow-go transition-colors duration-quick ${category === x.id ? "bg-ember font-medium text-white" : "bg-card text-muted active:bg-subtle"}`}
              >
                {tp(x.key)}
              </button>
            ))}
          </>
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
                  className="go-surface flex overflow-hidden transition-shadow duration-quick hover:shadow-md focus-within:ring-2 focus-within:ring-ember active:scale-[0.99]"
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
                          className={`shrink-0 whitespace-nowrap rounded-full px-tight py-inline text-[12px] font-medium ${live.tone === "none" ? "bg-danger/10 text-danger" : "bg-ember/15 text-brand-foreground"}`}
                        >
                          {live.tone === "none" ? tp("sheet.soldOut") : tp("live.limited")}
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-3 text-[15px] font-semibold leading-snug">{p.name}</span>
                      <span className="mt-inline text-[20px] font-bold leading-none text-ember">
                        {formatPriceShort(from, currency)}
                      </span>
                      <span className="mt-tight line-clamp-2 text-[13px] leading-tight text-muted">
                        {behaviourSubtitle(p, { resources, team })}
                      </span>
                      {live && (
                        <span
                          className={`mt-inline flex items-center gap-inline text-[13px] leading-tight ${live.tone === "none" ? "text-danger" : live.tone === "low" ? "font-medium text-brand-foreground" : "text-success"}`}
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
              className="flex min-h-[140px] flex-col items-center justify-center gap-tight rounded-go border border-dashed border-strong text-muted transition-colors duration-quick hover:bg-subtle active:bg-ember/10"
            >
              <Plus size={20} strokeWidth={1.5} />
              <span className="text-[13px]">{t("catalogue.custom")}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/* ── What the till can sell ────────────────────────────────────────────────
 *
 * The cart till's wall, drawn the same way: a search pill, then image-first
 * cards in a two-column phone grid, shop items under a quiet "Shop" heading.
 * The tap does what the glyph says — "+" adds at once, "›" opens the choices
 * inside the sale below.
 *
 * It has two homes (a column on a tablet, a section of the scroll on a phone)
 * and the page renders it in exactly one of them.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, ShoppingBag } from "lucide-react";
import { SkeletonText } from "@/components/ui";
import type { InventoryItemView, Product, Resource, Staff } from "@/lib/api";
import { useBehaviourSubtitle } from "@/lib/behaviour";
import { posLiveState } from "@/lib/posState";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatClock, formatDay, formatPriceShort } from "@/lib/format";
import { HeldButton } from "../../pos/HeldSheet";
import { BookingGlyph, WallHeading, WallRow, WallTile } from "../../_components/WallTile";
import { GENERIC_UNITS, ShopGlyph, productNeedsSheet, tilePrice } from "../_lib/wall";

const NOW_MINUTES = 12 * 60;

export function Catalogue({
  products,
  resources,
  team,
  shop,
  currency,
  query,
  onQuery,
  onPick,
  onTapItem,
  onCustom,
  countOf,
  shopCountOf,
  heldCount,
  onHeld,
  loading,
}: {
  products: Product[];
  resources: Resource[];
  team: Staff[];
  shop: InventoryItemView[];
  currency: string;
  query: string;
  onQuery: (q: string) => void;
  onPick: (p: Product) => void;
  onTapItem: (i: InventoryItemView) => void;
  onCustom: () => void;
  countOf: (productId: string) => number;
  shopCountOf: (itemId: string) => number;
  /** Places this venue is holding for people; the button shows only while > 0. */
  heldCount: number;
  onHeld: () => void;
  loading: boolean;
}) {
  const t = useTranslations("sell");
  const tp = useTranslations("pos");
  const subtitle = useBehaviourSubtitle();

  // Field passes issue from Quick pass, not from the wall.
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => products.filter((p) => p.bookingType !== "BT-14").filter((p) => !q || p.name.toLowerCase().includes(q)),
    [products, q],
  );
  const shownItems = useMemo(
    () => shop.filter((i) => !q || i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q)),
    [shop, q],
  );
  const shelfHeading = shownItems.length > 0 && shown.length > 0;

  const liveWords = useMemo(
    () => ({
      soldOutToday: tp("live.soldOutToday"),
      noneLeftToday: tp("live.noneLeftToday"),
      busyNow: tp("live.busyNow"),
      leftOfTotal: (left: number, total: number) => tp("live.leftOfTotal", { left, total }),
      nextAt: (time: string, left: number) => tp("live.nextAt", { time: formatClock(time), left }),
      freeOfTotal: (free: number, total: number) => tp("live.freeOfTotal", { free, total }),
      startsOn: (d: string) => tp("live.startsOn", { date: formatDay(d) }),
      nextDay: (d: string, time: string) => tp("live.nextDay", { day: formatDay(d, { weekday: true }), time: formatClock(time) }),
      providersFree: (free: number, total: number) => tp("live.providersFree", { free, total }),
    }),
    [tp],
  );

  const customTile = (
    <WallRow onClick={onCustom} icon={<Plus size={18} strokeWidth={2} />}>
      {t("catalogue.custom")}
    </WallRow>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-comfortable">
      {/* On a desktop the wall scrolls under its own toolbar, which stays put. */}
      <div data-top-band className="flex items-center gap-tight rail:sticky rail:top-0 rail:z-10 rail:-mx-major rail:mb-comfortable rail:h-16 rail:shrink-0 rail:bg-surface rail:px-major">
        <div
          data-focus-host
          className="card-surface flex h-11 min-w-0 flex-1 items-center gap-tight rounded-full px-comfortable focus-within:ring-2 focus-within:ring-inset focus-within:ring-ember"
        >
          <Search size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label={t("catalogue.searchPlaceholder")}
            placeholder={t("catalogue.searchPlaceholder")}
            className="-my-px h-11 w-full min-w-0 text-ellipsis bg-transparent text-base placeholder:text-muted"
          />
          {query && (
            <button type="button" onClick={() => onQuery("")} className="-mr-2 flex h-11 shrink-0 items-center px-tight text-sm text-muted hover:text-fg">
              {t("catalogue.clear")}
            </button>
          )}
        </div>
        {/* Places held for people. Only while there are some; the count rides
            on the button and the name says it in words. */}
        {heldCount > 0 && <HeldButton count={heldCount} onClick={onHeld} />}
      </div>

      <div className="min-w-0">
        {loading ? (
          <div aria-busy="true" className="card-surface p-section"><SkeletonText lines={3} /></div>
        ) : (
          <div className="grid grid-cols-2 gap-comfortable sm:grid-cols-3 xl:grid-cols-4 rail:grid-cols-[repeat(auto-fill,minmax(min(100%,11.5rem),1fr))] rail:gap-section">
            {shown.map((p) => {
              const live = posLiveState(p, DEMO_TODAY, NOW_MINUTES, liveWords);
              const n = countOf(p.id);
              return (
                <WallTile
                  key={p.id}
                  onClick={() => onPick(p)}
                  opensSheet={productNeedsSheet(p)}
                  ariaLabel={n > 0 ? tp("wall.inSaleAria", { name: p.name, count: n }) : undefined}
                  image={p.images?.[0]?.url}
                  glyph={<BookingGlyph bookingType={p.bookingType} />}
                  name={p.name}
                  price={formatPriceShort(tilePrice(p, DEMO_TODAY, NOW_MINUTES), currency)}
                  meta={subtitle(p, { resources, team })}
                  live={live}
                  count={n}
                  flag={live && live.tone === "low" ? tp("live.limited") : undefined}
                  soldOut={!!live && live.tone === "none"}
                  soldOutLabel={tp("sheet.soldOut")}
                />
              );
            })}
            {shelfHeading && customTile}
            {shelfHeading && (
              <WallHeading icon={<ShoppingBag size={16} strokeWidth={1.75} aria-hidden />}>
                {tp("shop.chip")}
              </WallHeading>
            )}
            {shownItems.map((i) => {
              const gone = i.tracked && i.onHand <= 0;
              const low = i.tracked && !gone && i.onHand <= i.lowAt;
              const inCart = shopCountOf(i.id);
              return (
                <WallTile
                  key={i.id}
                  onClick={() => onTapItem(i)}
                  ariaLabel={inCart > 0 ? tp("wall.inSaleAria", { name: i.name, count: inCart }) : undefined}
                  glyph={<ShopGlyph kind={i.kind} />}
                  name={i.name}
                  price={formatPriceShort(i.price, currency)}
                  meta={
                    GENERIC_UNITS.has(i.unit.trim().toLowerCase())
                      ? i.kind === "merch"
                        ? null
                        : tp(`shop.kind.${i.kind}`)
                      : tp("shop.per", { unit: i.unit })
                  }
                  live={low ? { tone: "low", text: tp("shop.left", { count: i.onHand, unit: i.unit }) } : null}
                  count={inCart}
                  soldOut={gone}
                  soldOutLabel={tp("sheet.soldOut")}
                />
              );
            })}
            {!shelfHeading && customTile}
          </div>
        )}
      </div>
    </div>
  );
}

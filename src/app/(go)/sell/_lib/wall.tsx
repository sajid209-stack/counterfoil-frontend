import { CupSoda, ShoppingBag, Sparkles, Wrench } from "lucide-react";
import type { Product } from "@/lib/api";
import { productDurationPrice } from "@/lib/duration";
import { resolveProductPrice } from "@/lib/pricing";
import { isFlexibleResource, isResourceType, needsSchedule, toTime } from "@/lib/schedule";
import { flexDurations } from "@/lib/sale/selection";

/** Whether a tap on this booking has something to choose (a sheet-sized
 *  decision) rather than adding it at once. The wall draws a chevron for the
 *  first and a "+" for the second, and the tap does what the glyph says. */
export function productNeedsSheet(p: Product): boolean {
  const tiers = p.tiers.filter((t) => t.active);
  return (
    needsSchedule(p.bookingType) ||
    isResourceType(p.bookingType) ||
    p.bookingType === "BT-10" ||
    p.bookingType === "BT-13" ||
    (p.sections?.length ?? 0) > 0 ||
    !!p.layoutId ||
    tiers.some((t) => t.donation) ||
    tiers.length > 1 ||
    tiers.length < 1
  );
}

/** What one tap on the tile sells, now: the first ticket type, a field's
 *  resolved hourly price, a lane's price for its shortest length. */
export function tilePrice(p: Product, date: string, nowMinutes: number): number {
  const tiers = p.tiers.filter((x) => x.active && !x.donation);
  const base = tiers.length ? Math.min(...tiers.map((x) => x.price)) : 0;
  const noon = toTime(Math.max(12 * 60, Math.ceil(nowMinutes / 60) * 60));
  if (isFlexibleResource(p.bookingType)) {
    const d = flexDurations(p)[0] ?? 60;
    return productDurationPrice(p, date, noon, d, base);
  }
  if (isResourceType(p.bookingType)) return resolveProductPrice(p, date, noon, base);
  if (p.sections?.length && !tiers.length) return Math.min(...p.sections.map((x) => x.price));
  return tiers[0]?.price ?? base;
}

export const GENERIC_UNITS = new Set(["each", "unit", "units", "item", "items", "pc", "pcs", "piece", "pieces"]);

export function ShopGlyph({ kind }: { kind: "merch" | "food" | "equipment" | "service" }) {
  const Icon = kind === "food" ? CupSoda : kind === "equipment" ? Wrench : kind === "service" ? Sparkles : ShoppingBag;
  return <Icon strokeWidth={1.5} aria-hidden />;
}

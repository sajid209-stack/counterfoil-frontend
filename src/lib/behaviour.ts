import type { Product, Resource, Staff } from "@/lib/api/types";

/** A derived, plain-language line describing how a product books — shown on POS
 *  tiles instead of any internal code. If it can't be derived, the config is
 *  incomplete (returns "Set up booking"). */
export function behaviourSubtitle(
  product: Product,
  ctx: { resources?: Resource[]; team?: Staff[] } = {},
): string {
  const sch = product.schedule;
  const resNoun = () => {
    const rs = (ctx.resources ?? []).filter((r) => (product.resourceIds ?? []).includes(r.id));
    const plural = rs[0]?.nounPlural ?? "resources";
    return `${(product.resourceIds ?? []).length} ${plural.toLowerCase()}`;
  };

  switch (product.bookingType) {
    case "BT-01": return "Open entry · no time needed";
    case "BT-02": return "Book a date · valid a while";
    case "BT-06": return "Book a date · daily cap";
    case "BT-03": return sch ? `${sch.slotMinutes}-min slots` : "Timed slots";
    case "BT-09": return sch ? `Guided · every ${sch.slotMinutes} min` : "Guided departures";
    case "BT-04": return `${sch?.slotMinutes === 60 ? "Hourly" : "Fixed"} slots · ${resNoun()}`;
    case "BT-05": {
      const from = product.flexibleDurations?.[0];
      return `From ${from ?? 60} min · ${resNoun()}`;
    }
    case "BT-10": {
      const names = (ctx.team ?? []).filter((m) => (product.providerIds ?? []).includes(m.id)).map((m) => m.name.split(" ")[0]);
      const who = names.length ? `With ${names.join(" or ")}` : `A ${product.providerNoun ?? "provider"}`;
      const dur = (product.flexibleDurations ?? []).join("/");
      return dur ? `${who} · ${dur} min` : who;
    }
    case "BT-07": return (product.sections ?? []).map((s) => s.name).join(" & ") || "Choose a section";
    case "BT-08": return `${(product.bundleComponentIds ?? []).length} attractions`;
    case "BT-12": return `${product.credits?.count ?? 0} credits`;
    case "BT-13": return `${(product.courseDates ?? []).length} sessions${product.courseDates?.[0] ? ` · from ${product.courseDates[0]}` : ""}`;
    case "BT-14": return "Quick pass";
    default: return "Set up booking";
  }
}

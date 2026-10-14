import { useTranslations } from "next-intl";
import { formatDay } from "@/lib/format";
import type { Product, Resource, Staff } from "@/lib/api/types";

type Ctx = { resources?: Resource[]; team?: Staff[] };

/**
 * A derived, plain-language line describing how a booking is sold — shown on
 * till tiles, the catalogue list and the public page instead of any internal
 * code. If it can't be derived, the setup is unfinished and it says so.
 *
 * A hook, because the line is read by people who may read only Bangla: it was
 * a string of fixed English ("Book a date · daily cap", "Guided · every 240
 * min") on every one of those screens, whatever language the page was in.
 * The words follow docs/plain-language.md — "time slot" not "session",
 * "visits" not "credits", "limited per day" not "daily cap".
 */
/** A schedule whose window holds a single session — "every 2 hr" would be a
 *  number about a gap that never happens. */
function oneSessionADay(sch: { startTime: string; endTime: string; slotMinutes: number }): boolean {
  const m = (t: string) => { const [h, mm] = t.split(":").map(Number); return h * 60 + (mm || 0); };
  return m(sch.endTime) - m(sch.startTime) <= sch.slotMinutes;
}

export function useBehaviourSubtitle(): (product: Product, ctx?: Ctx) => string {
  const t = useTranslations("behaviour");

  const length = (minutes: number) =>
    minutes % 60 === 0 ? t("hours", { count: minutes / 60 }) : t("minutes", { count: minutes });

  return (product, ctx = {}) => {
    const sch = product.schedule;
    const places = () => {
      const rs = (ctx.resources ?? []).filter((r) => (product.resourceIds ?? []).includes(r.id));
      const n = (product.resourceIds ?? []).length;
      // The operator's own word for the thing — a turf's "Field", a centre's
      // "Lane" — which is data they typed, so it is not translated.
      const noun = n === 1 ? rs[0]?.nounSingular : rs[0]?.nounPlural;
      return noun ? t("placesNamed", { count: n, noun: noun.toLowerCase() }) : t("places", { count: n });
    };

    switch (product.bookingType) {
      case "BT-01": return t("openEntry");
      case "BT-02": return t("datePass");
      case "BT-06": return t("dailyLimit");
      case "BT-03":
        if (!sch) return t("slots");
        // A gap between sessions (a 90-minute class at 11 and at 4) makes the
        // interval a meaningless number; how long each one runs is what a buyer needs.
        return sch.slotMinutes > sch.sessionMinutes || oneSessionADay(sch)
          ? t("sessionsLasting", { length: length(sch.sessionMinutes) })
          : t("slotsEvery", { length: length(sch.slotMinutes) });
      case "BT-09": return sch ? t("guidedEvery", { length: length(sch.slotMinutes) }) : t("guided");
      case "BT-04":
        return sch?.slotMinutes === 60 ? t("byHour", { places: places() }) : t("bySlot", { places: places() });
      case "BT-05": {
        const from = product.durationConfig?.minMinutes ?? product.flexibleDurations?.[0] ?? 60;
        return t("fromLength", { length: length(from), places: places() });
      }
      case "BT-10": {
        const names = (ctx.team ?? []).filter((m) => (product.providerIds ?? []).includes(m.id)).map((m) => m.name.split(" ")[0]);
        const who = names.length ? t("withStaff", { names: names.join(" / ") }) : t("chooseStaff");
        const durs = product.flexibleDurations ?? [];
        return durs.length ? t("withLengths", { who, lengths: durs.map(length).join(" / ") }) : who;
      }
      case "BT-07": return (product.sections ?? []).map((s) => s.name).join(" & ") || t("chooseSeats");
      case "BT-08": return t("bundle", { count: (product.bundleComponentIds ?? []).length });
      case "BT-12": return t("visitPack", { count: product.credits?.count ?? 0 });
      case "BT-13": {
        const first = product.courseDates?.[0];
        const count = (product.courseDates ?? []).length;
        return first ? t("courseFrom", { count, date: formatDay(first) }) : t("course", { count });
      }
      case "BT-14": return t("quickPass");
      default: return t("unfinished");
    }
  };
}

/* Forgiving duration/time parsing + the flexible-duration pricing engine.
   Durations are minutes (integers). Times are "HH:MM" 24h strings. */
import type { DurationConfig, Minor, PricingRule, Product } from "@/lib/api/types";
import { resolveRulePrice } from "@/lib/pricing";
import { toMinutes, toTime } from "@/lib/schedule";

// ── Parsing — accept whatever a human types ─────────────────────────────────

/** "90" → 90 · "1:30" → 90 · "1h30" / "1h 30m" / "1 hr 30 min" → 90 · "1.5" → 90.
 *  Integers are minutes; decimals are hours. Returns null if unparseable. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  // "1:30"
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  // "1h30", "1h 30", "1 hr 30 min", "2h", "1hour"
  m = s.match(/^(\d+(?:\.\d+)?) ?h(?:r|rs|our|ours)? ?(?:(\d{1,2}) ?m(?:in|ins)?)?$/);
  if (m) return Math.round(parseFloat(m[1]) * 60) + (m[2] ? parseInt(m[2], 10) : 0);
  // "45m", "45 min"
  m = s.match(/^(\d+) ?m(?:in|ins)?$/);
  if (m) return parseInt(m[1], 10);
  // bare number: decimal = hours, integer = minutes
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) {
    const n = parseFloat(m[1]);
    return m[1].includes(".") ? Math.round(n * 60) : Math.round(n);
  }
  return null;
}

/** 90 → "1 hr 30 min" · 60 → "1 hr" · 45 → "45 min". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  if (h === 0) return `${mm} min`;
  if (mm === 0) return `${h} hr`;
  return `${h} hr ${mm} min`;
}

/** Short form for chips/prices: 90 → "1:30", 60 → "1:00", 45 → "0:45". */
export const formatDurationShort = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

/** "930" → "09:30" · "1830" → "18:30" · "6:30p" → "18:30" · "9" → "09:00".
 *  Returns null if unparseable or out of range. */
export function parseTimeOfDay(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const ampm = s.match(/(a|p)m?$/)?.[1];
  const core = ampm ? s.replace(/(a|p)m?$/, "") : s;
  let h: number, mm: number;
  let m = core.match(/^(\d{1,2}):(\d{2})$/);
  if (m) { h = parseInt(m[1], 10); mm = parseInt(m[2], 10); }
  else if ((m = core.match(/^(\d{3,4})$/))) {
    const digits = m[1];
    h = parseInt(digits.slice(0, digits.length - 2), 10);
    mm = parseInt(digits.slice(-2), 10);
  } else if ((m = core.match(/^(\d{1,2})$/))) { h = parseInt(m[1], 10); mm = 0; }
  else return null;
  if (ampm === "p" && h < 12) h += 12;
  if (ampm === "a" && h === 12) h = 0;
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ── The duration engine (liquid time) ───────────────────────────────────────

export function defaultDurationConfig(hourlyRate: Minor = 0): DurationConfig {
  return {
    minMinutes: 60, maxMinutes: 180, incrementMinutes: 30,
    pricingModel: "hourly", hourlyRate,
    mustEndByClose: true, walkInRoundMinutes: 15, leadTimeMinutes: 0,
  };
}

/** Valid bookable durations: min + n×increment up to max. */
export function durationOptions(cfg: DurationConfig): number[] {
  const { minMinutes: min, maxMinutes: max, incrementMinutes: inc } = cfg;
  if (min <= 0 || inc <= 0 || max < min) return [];
  const out: number[] = [];
  for (let d = min; d <= max; d += inc) out.push(d);
  return out;
}

/** Increment must divide the min→max range so every step lands on max. */
export const durationConfigError = (cfg: DurationConfig): string | null => {
  if (cfg.minMinutes <= 0) return "Minimum duration must be set.";
  if (cfg.maxMinutes < cfg.minMinutes) return "Maximum must be at least the minimum.";
  if (cfg.incrementMinutes <= 0) return "Increment must be set.";
  if ((cfg.maxMinutes - cfg.minMinutes) % cfg.incrementMinutes !== 0)
    return `An increment of ${formatDuration(cfg.incrementMinutes)} doesn't fit evenly between ${formatDuration(cfg.minMinutes)} and ${formatDuration(cfg.maxMinutes)}.`;
  return null;
};

/** The model's own price for a duration, before time-band rules. */
export function durationBasePrice(cfg: DurationConfig, minutes: number): Minor {
  switch (cfg.pricingModel) {
    case "list":
      return cfg.priceList?.[minutes] ?? Math.round(((cfg.hourlyRate ?? 0) * minutes) / 60);
    case "base_extension": {
      const extra = Math.max(0, minutes - cfg.minMinutes);
      const steps = cfg.incrementMinutes > 0 ? Math.ceil(extra / cfg.incrementMinutes) : 0;
      return (cfg.basePrice ?? 0) + steps * (cfg.extensionPrice ?? 0);
    }
    default:
      return Math.round(((cfg.hourlyRate ?? 0) * minutes) / 60);
  }
}

/** The hourly rate the config implies — the reference bands scale against. */
export function hourlyEquivalent(cfg: DurationConfig): Minor {
  if (cfg.pricingModel === "hourly") return cfg.hourlyRate ?? 0;
  if (cfg.pricingModel === "base_extension")
    return cfg.minMinutes > 0 ? Math.round(((cfg.basePrice ?? 0) * 60) / cfg.minMinutes) : 0;
  const list = cfg.priceList ?? {};
  if (list[60] != null) return list[60];
  const first = durationOptions(cfg)[0];
  return first && list[first] != null ? Math.round((list[first] * 60) / first) : (cfg.hourlyRate ?? 0);
}

const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Price for [startTime, startTime+minutes) on a date: the model's base total,
 *  scaled by the time-band rules minute-by-minute — a booking crossing a band
 *  boundary prices each portion and blends. */
export function resolveDurationPrice(
  cfg: DurationConfig,
  rules: PricingRule[],
  date: string,
  startTime: string,
  minutes: number,
): Minor {
  const base = durationBasePrice(cfg, minutes);
  const hourly = hourlyEquivalent(cfg);
  if (!rules.length || hourly <= 0 || minutes <= 0) return base;
  const dow = dowOf(date);
  const start = toMinutes(startTime);
  let banded = 0;
  for (let m = 0; m < minutes; m++) {
    banded += resolveRulePrice(rules, dow, toTime((start + m) % 1440), hourly) / 60;
  }
  const flat = (hourly * minutes) / 60;
  return Math.round((base * banded) / flat);
}

export interface PriceSegment {
  minutes: number;
  ratePerHour: Minor;
}

/** The banded rate segments across a span — the "why is it this price" line.
 *  One segment → "৳800 × 2 hr"; a band crossing → "1 hr @ ৳800 + 1 hr @ ৳1,200". */
export function priceSegments(
  cfg: DurationConfig,
  rules: PricingRule[],
  date: string,
  startTime: string,
  minutes: number,
): PriceSegment[] {
  const hourly = hourlyEquivalent(cfg);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const start = toMinutes(startTime);
  const segs: PriceSegment[] = [];
  for (let m = 0; m < minutes; m++) {
    const rate = rules.length ? resolveRulePrice(rules, dow, toTime((start + m) % 1440), hourly) : hourly;
    const last = segs[segs.length - 1];
    if (last && last.ratePerHour === rate) last.minutes += 1;
    else segs.push({ minutes: 1, ratePerHour: rate });
  }
  return segs;
}

/** Convenience for POS: a product's flexible price at a concrete start. */
export function productDurationPrice(product: Product, date: string, startTime: string, minutes: number, fallbackHourly: Minor): Minor {
  const cfg = product.durationConfig ?? { ...defaultDurationConfig(fallbackHourly), minMinutes: product.flexibleDurations?.[0] ?? 60, maxMinutes: product.flexibleDurations?.at(-1) ?? 180 };
  if (!product.durationConfig && !cfg.hourlyRate) cfg.hourlyRate = fallbackHourly;
  return resolveDurationPrice(cfg, product.pricingRules ?? [], date, startTime, minutes);
}

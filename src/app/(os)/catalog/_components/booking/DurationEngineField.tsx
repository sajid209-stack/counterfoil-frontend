"use client";

import { useTranslations } from "next-intl";
import { DurationInput, FormField } from "@/components/ui";
import {
  durationConfigError,
  durationOptions,
  formulaPrice,
  hourlyEquivalent,
  isDealDuration,
  resolveDurationPrice,
} from "@/lib/duration";
import { formatClock, formatClockMin, formatMoney, formatPriceShort } from "@/lib/format";
import { applyResourceRate } from "@/lib/api";
import type { DurationConfig, PricingRule, Resource } from "@/lib/api";
import { useCatalogFormat } from "../../_lib/useCatalogFormat";

const majorToMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const minorToMajor = (m: number | undefined) => (m != null && m > 0 ? String(m / 100) : "");
/** Minutes after midnight as a person reads them: "5:15 PM". */
const clock = (min: number) => formatClockMin(min);

const MODELS = ["hourly", "list", "base_extension"] as const;

/** The liquid-time editor: min/max/increment, one of three pricing models,
 *  operational toggles, and the MANDATORY live preview of concrete prices.
 *  Every help line says what the value means right now — "A walk-in at 17:07
 *  starts at 17:15" — rather than what the setting is called. */
export function DurationEngineField({
  value,
  onChange,
  pricingRules = [],
  resources = [],
  currency = "BDT",
}: {
  value: DurationConfig;
  onChange: (cfg: DurationConfig) => void;
  pricingRules?: PricingRule[]; // for the banded preview example
  resources?: Resource[]; // per-resource rate examples in the preview
  currency?: string;
}) {
  const t = useTranslations("catalog.duration");
  const { dur, dayShort } = useCatalogFormat();
  const set = <K extends keyof DurationConfig>(k: K, v: DurationConfig[K]) => onChange({ ...value, [k]: v });
  const err = durationConfigError(value);
  const options = err ? [] : durationOptions(value);
  const symbol = currency === "BDT" ? "৳" : currency;

  // Preview: every bookable duration with its resolved (unbanded) price, plus
  // one concrete banded example so the operator verifies real numbers.
  const EXAMPLE = { date: "2026-08-01", time: "19:00", dow: 6 }; // a Saturday
  const exampleLabel = `${dayShort(EXAMPLE.dow)} ${formatClock(EXAMPLE.time)}`;
  const exampleMinutes = options.includes(120) ? 120 : options[options.length - 1] ?? 60;
  const previewPrice = (minutes: number) => resolveDurationPrice(value, [], EXAMPLE.date, "10:00", minutes);
  const bandedExample = resolveDurationPrice(value, pricingRules, EXAMPLE.date, EXAMPLE.time, exampleMinutes);

  const dealCount = Object.keys(value.priceOverrides ?? {}).length;

  const fillFromHourly = () => {
    const rate = hourlyEquivalent(value) || value.hourlyRate || 0;
    if (!rate) return;
    const list: Record<number, number> = {};
    for (const d of options) list[d] = Math.round((rate * d) / 60);
    onChange({ ...value, priceList: list });
  };

  /* The example the hourly help line works out: an hour and a half, the
     length an operator most often has to explain at the counter. */
  const hourly = value.hourlyRate ?? 0;
  const walkFrom = 17 * 60 + 7;
  const round = value.walkInRoundMinutes || 15;
  const walkTo = Math.ceil(walkFrom / round) * round;

  return (
    <div className="flex flex-col gap-section">
      <div className="grid gap-section sm:grid-cols-3">
        <DurationInput label={t("shortest")} value={value.minMinutes} min={5} onChange={(n) => set("minMinutes", n)} chips={[30, 60]} />
        <DurationInput label={t("longest")} value={value.maxMinutes} min={5} onChange={(n) => set("maxMinutes", n)} chips={[120, 180]} />
        <DurationInput label={t("step")} value={value.incrementMinutes} min={5} step={5} onChange={(n) => set("incrementMinutes", n)} chips={[15, 30, 60]} />
      </div>
      {err ? (
        <p className="rounded-sm bg-danger-wash px-comfortable py-tight text-[0.8125rem] text-danger">{err}</p>
      ) : (
        <p className="text-[13px] text-muted">{t("lengths", { list: options.map(dur).join(" · ") })}</p>
      )}

      <div className="flex flex-col gap-tight">
        <span className="text-[0.8125rem] font-medium text-muted">{t("modelTitle")}</span>
        <div className="flex flex-wrap gap-tight">
          {MODELS.map((m) => {
            const on = value.pricingModel === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => set("pricingModel", m)}
                className={`flex min-h-11 flex-col items-start rounded-sm bg-muted-wash px-comfortable py-tight text-left transition-shadow duration-quick ${on ? "ring-2 ring-inset ring-ember" : "hover:ring-2 hover:ring-inset hover:ring-ember/30"}`}
              >
                <span className="text-sm font-medium">{t(`model.${m}.title`)}</span>
                <span className="text-[0.8125rem] text-muted">{t(`model.${m}.helper`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {value.pricingModel === "hourly" && (
        <FormField
          label={`${t("hourlyLabel")} (${symbol})`}
          variant="number"
          placeholder={t("pricePlaceholder")}
          value={minorToMajor(value.hourlyRate)}
          onChange={(e) => set("hourlyRate", majorToMinor(e.target.value))}
          className="max-w-xs"
          help={hourly > 0 ? t("hourlyHelp", { time: dur(90), price: formatPriceShort(Math.round(hourly * 1.5), currency) }) : t("hourlyHelpEmpty")}
        />
      )}

      {value.pricingModel === "list" && !err && (
        <div className="flex flex-col gap-tight">
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] font-medium text-muted">{t("listTitle")}</span>
            <button type="button" onClick={fillFromHourly} className="min-h-11 text-[13px] text-brand-foreground hover:underline md:min-h-0">{t("fillFromHourly")}</button>
          </div>
          <div className="grid gap-tight sm:grid-cols-3">
            {options.map((d) => (
              <FormField key={d} label={`${dur(d)} (${symbol})`} variant="number" value={minorToMajor(value.priceList?.[d])} onChange={(e) => set("priceList", { ...value.priceList, [d]: majorToMinor(e.target.value) })} />
            ))}
          </div>
        </div>
      )}

      {value.pricingModel === "base_extension" && (
        <div className="grid gap-section sm:grid-cols-2">
          <FormField label={`${t("firstPart", { time: dur(value.minMinutes) })} (${symbol})`} variant="number" value={minorToMajor(value.basePrice)} onChange={(e) => set("basePrice", majorToMinor(e.target.value))} />
          <FormField label={`${t("eachExtra", { time: dur(value.incrementMinutes) })} (${symbol})`} variant="number" value={minorToMajor(value.extensionPrice)} onChange={(e) => set("extensionPrice", majorToMinor(e.target.value))} />
        </div>
      )}

      {/* Special prices. A formula gets you most of the way — "an hour is
          ৳1,000 and every 15 minutes after is ৳250" — but the two-hour price an
          operator actually sells is usually a round number they chose, not
          what the arithmetic produces. Every bookable length is listed with
          what the formula would charge; typing over one sets a special price,
          clearing it hands that length back to the formula. */}
      {value.pricingModel !== "list" && !err && options.length > 0 && (
        <div className="flex flex-col gap-tight">
          <div className="flex flex-wrap items-baseline justify-between gap-tight">
            <span className="text-[0.8125rem] font-medium text-muted">{t("dealsTitle")}</span>
            {dealCount > 0 && (
              <button type="button" onClick={() => set("priceOverrides", undefined)} className="min-h-11 text-[13px] text-brand-foreground hover:underline md:min-h-0">
                {t("clearDeals", { count: dealCount })}
              </button>
            )}
          </div>
          <p className="text-[0.8125rem] text-muted">{t("dealsHelp")}</p>
          <div className="grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
            {options.map((d) => {
              const formula = formulaPrice(value, d);
              const deal = isDealDuration(value, d);
              return (
                <div key={d} className={`flex items-center gap-comfortable rounded-sm bg-muted-wash p-comfortable ${deal ? "ring-2 ring-inset ring-ember" : ""}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{dur(d)}</span>
                    <span className={`font-mono text-[12px] ${deal ? "text-muted line-through" : "text-muted"}`}>
                      {formatMoney(formula, currency)}
                    </span>
                  </span>
                  {/* The empty field shows the formula's own number, so an
                      untouched length reads as "this is what it costs now". */}
                  <input
                    inputMode="decimal"
                    placeholder={String(Math.round(formula / 100))}
                    aria-label={t("dealFor", { time: dur(d) })}
                    value={minorToMajor(value.priceOverrides?.[d])}
                    onChange={(e) => {
                      const next = { ...(value.priceOverrides ?? {}) };
                      const raw = e.target.value.trim();
                      if (!raw) delete next[d];
                      else next[d] = majorToMinor(raw);
                      set("priceOverrides", Object.keys(next).length ? next : undefined);
                    }}
                    className="h-11 w-24 shrink-0 rounded-sm border border-line bg-card px-tight text-right font-mono text-sm outline-none placeholder:text-muted focus:border-ember md:h-10"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-section sm:grid-cols-3">
        <FormField
          label={t("mustEnd")}
          variant="toggle"
          checked={value.mustEndByClose}
          onChange={(e) => set("mustEndByClose", (e.target as HTMLInputElement).checked)}
          help={value.mustEndByClose ? t("mustEndOn") : t("mustEndOff")}
        />
        <DurationInput
          label={t("walkIn")}
          value={value.walkInRoundMinutes}
          min={5}
          step={5}
          onChange={(n) => set("walkInRoundMinutes", n)}
          chips={[5, 10, 15]}
          help={t("walkInHelp", { from: clock(walkFrom), to: clock(walkTo) })}
        />
        <DurationInput
          label={t("notice")}
          value={value.leadTimeMinutes}
          onChange={(n) => set("leadTimeMinutes", n)}
          chips={[0, 15, 30]}
          help={value.leadTimeMinutes > 0 ? t("noticeHelp", { time: dur(value.leadTimeMinutes) }) : t("noticeNone")}
        />
      </div>

      {/* The mandatory preview — concrete numbers before saving. */}
      {!err && options.length > 0 && (
        <div className="rounded-sm border border-inverse bg-card p-section">
          <p className="text-[0.8125rem] font-medium text-muted">{t("preview")}</p>
          <p className="mt-inline text-[13px] tabular-nums">
            {options.map((d, i) => (
              <span key={d}>
                {i > 0 && " · "}
                <span className={isDealDuration(value, d) ? "font-medium text-brand-foreground" : ""}>
                  {dur(d)} {formatMoney(previewPrice(d), currency)}
                </span>
              </span>
            ))}
          </p>
          {dealCount > 0 && <p className="mt-inline text-[12px] text-muted">{t("previewDeals")}</p>}
          {pricingRules.length > 0 && (
            <p className="mt-tight text-[13px] text-muted">
              {t("example", { when: exampleLabel, time: dur(exampleMinutes), price: formatMoney(bandedExample, currency) })}
              {bandedExample !== previewPrice(exampleMinutes) && ` ${t("exampleBands")}`}
            </p>
          )}
          {resources.some((r) => r.rateOverride) && (
            <p className="mt-tight text-[12px] tabular-nums text-muted">
              {exampleLabel} · {resources.slice(0, 4).map((r) => `${r.name} → ${formatMoney(applyResourceRate(bandedExample, exampleMinutes, r), currency)}`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

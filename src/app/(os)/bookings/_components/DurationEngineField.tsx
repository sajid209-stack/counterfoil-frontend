"use client";

import { DurationInput, FormField } from "@/components/ui";
import {
  durationConfigError,
  durationOptions,
  formatDuration,
  formatDurationShort,
  formulaPrice,
  hourlyEquivalent,
  isDealDuration,
  resolveDurationPrice,
} from "@/lib/duration";
import { formatMoney } from "@/lib/format";
import { applyResourceRate } from "@/lib/api";
import type { DurationConfig, PricingRule, Resource } from "@/lib/api";

const majorToMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const minorToMajor = (m: number | undefined) => (m != null && m > 0 ? String(m / 100) : "");

/** The liquid-time editor: min/max/increment, one of three pricing models,
 *  operational toggles, and the MANDATORY live preview of concrete prices. */
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
  const set = <K extends keyof DurationConfig>(k: K, v: DurationConfig[K]) => onChange({ ...value, [k]: v });
  const err = durationConfigError(value);
  const options = err ? [] : durationOptions(value);

  // Preview: every bookable duration with its resolved (unbanded) price, plus
  // one concrete banded example so the operator verifies real numbers.
  const EXAMPLE = { date: "2026-08-01", time: "19:00", label: "Sat 19:00" }; // a Saturday
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

  return (
    <div className="flex flex-col gap-section">
      <div className="grid gap-section sm:grid-cols-3">
        <DurationInput label="Shortest booking" value={value.minMinutes} min={5} onChange={(n) => set("minMinutes", n)} chips={[30, 60]} />
        <DurationInput label="Longest booking" value={value.maxMinutes} min={5} onChange={(n) => set("maxMinutes", n)} chips={[120, 180]} />
        <DurationInput label="In steps of" value={value.incrementMinutes} min={5} step={5} onChange={(n) => set("incrementMinutes", n)} chips={[15, 30, 60]} />
      </div>
      {err ? (
        <p className="rounded-sm border border-danger bg-danger/5 px-comfortable py-tight text-[13px] text-danger">{err}</p>
      ) : (
        <p className="text-[13px] text-muted">
          Bookable durations: <span className="font-mono text-[12px]">{options.map(formatDurationShort).join(" · ")}</span>
        </p>
      )}

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-muted">How is it priced?</span>
        <div className="flex flex-wrap gap-tight">
          {([
            { v: "hourly", label: "Hourly rate", helper: "One rate, prorated" },
            { v: "list", label: "Price list", helper: "A price per duration" },
            { v: "base_extension", label: "Base + extension", helper: "First block, then per step" },
          ] as const).map((o) => (
            <button key={o.v} type="button" onClick={() => set("pricingModel", o.v)} className={`flex flex-col items-start rounded-sm border px-comfortable py-tight text-left ${value.pricingModel === o.v ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>
              <span className="text-sm font-medium">{o.label}</span>
              <span className={`text-[12px] ${value.pricingModel === o.v ? "opacity-70" : "text-faint"}`}>{o.helper}</span>
            </button>
          ))}
        </div>
      </div>

      {value.pricingModel === "hourly" && (
        <FormField label={`Rate per hour (${currency})`} variant="number" value={minorToMajor(value.hourlyRate)} onChange={(e) => set("hourlyRate", majorToMinor(e.target.value))} className="max-w-xs" help="Durations are prorated: 1 hr 15 min costs 1.25× this." />
      )}

      {value.pricingModel === "list" && !err && (
        <div className="flex flex-col gap-tight">
          <div className="flex items-center justify-between">
            <span className="type-label text-[12px] text-muted">Price per duration</span>
            <button type="button" onClick={fillFromHourly} className="text-[13px] text-brand-foreground hover:underline">Fill from hourly rate</button>
          </div>
          <div className="grid gap-tight sm:grid-cols-3">
            {options.map((d) => (
              <FormField key={d} label={formatDuration(d)} variant="number" value={minorToMajor(value.priceList?.[d])} onChange={(e) => set("priceList", { ...value.priceList, [d]: majorToMinor(e.target.value) })} />
            ))}
          </div>
        </div>
      )}

      {value.pricingModel === "base_extension" && (
        <div className="grid gap-section sm:grid-cols-2">
          <FormField label={`First ${formatDuration(value.minMinutes)} (${currency})`} variant="number" value={minorToMajor(value.basePrice)} onChange={(e) => set("basePrice", majorToMinor(e.target.value))} />
          <FormField label={`Each extra ${formatDuration(value.incrementMinutes)} (${currency})`} variant="number" value={minorToMajor(value.extensionPrice)} onChange={(e) => set("extensionPrice", majorToMinor(e.target.value))} />
        </div>
      )}

      {/* Deal prices. A formula gets you most of the way — "an hour is ৳1,000
          and every 15 minutes after is ৳250" — but the two-hour price an
          operator actually sells is usually a round number they chose, not
          what the arithmetic produces. Every bookable duration is listed with
          what the formula would charge; typing over one sets a deal, clearing
          it hands that duration back to the formula. */}
      {value.pricingModel !== "list" && !err && options.length > 0 && (
        <div className="flex flex-col gap-tight">
          <div className="flex flex-wrap items-baseline justify-between gap-tight">
            <span className="type-label text-[12px] text-muted">Deal prices</span>
            {dealCount > 0 && (
              <button type="button" onClick={() => set("priceOverrides", undefined)} className="text-[13px] text-brand-foreground hover:underline">
                Clear all {dealCount}
              </button>
            )}
          </div>
          <p className="text-[12px] text-faint">
            Optional. Leave a duration blank and it follows the formula above.
          </p>
          <div className="grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
            {options.map((d) => {
              const formula = formulaPrice(value, d);
              const deal = isDealDuration(value, d);
              return (
                <div key={d} className={`flex items-center gap-comfortable rounded-sm border p-comfortable ${deal ? "border-ember bg-ember/5" : "border-line"}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{formatDuration(d)}</span>
                    <span className={`font-mono text-[12px] ${deal ? "text-faint line-through" : "text-muted"}`}>
                      {formatMoney(formula, currency)}
                    </span>
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="—"
                    aria-label={`Deal price for ${formatDuration(d)}`}
                    value={minorToMajor(value.priceOverrides?.[d])}
                    onChange={(e) => {
                      const next = { ...(value.priceOverrides ?? {}) };
                      const raw = e.target.value.trim();
                      if (!raw) delete next[d];
                      else next[d] = majorToMinor(raw);
                      set("priceOverrides", Object.keys(next).length ? next : undefined);
                    }}
                    className="h-10 w-24 shrink-0 rounded-sm border border-line bg-card px-tight text-right font-mono text-sm outline-none focus:border-ember"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-section sm:grid-cols-3">
        <FormField label="Must end by closing" variant="toggle" checked={value.mustEndByClose} onChange={(e) => set("mustEndByClose", (e.target as HTMLInputElement).checked)} help="Off: bookings can run past close (night turf)." />
        <DurationInput label="Walk-in rounding" value={value.walkInRoundMinutes} min={5} step={5} onChange={(n) => set("walkInRoundMinutes", n)} chips={[5, 10, 15]} help='"Start now" rounds to this.' />
        <DurationInput label="Lead time" value={value.leadTimeMinutes} onChange={(n) => set("leadTimeMinutes", n)} chips={[0, 15, 30]} help="Minimum notice before start." />
      </div>

      {/* The mandatory preview — concrete numbers before saving. */}
      {!err && options.length > 0 && (
        <div className="rounded-sm border border-inverse bg-card p-section">
          <p className="type-label text-[12px] text-faint">Preview</p>
          <p className="mt-inline font-mono text-[13px]">
            Bookable:{" "}
            {options.map((d, i) => (
              <span key={d}>
                {i > 0 && " · "}
                <span className={isDealDuration(value, d) ? "font-medium text-brand-foreground" : ""}>
                  {formatDurationShort(d)} {formatMoney(previewPrice(d), currency)}
                </span>
              </span>
            ))}
          </p>
          {dealCount > 0 && (
            <p className="mt-inline text-[12px] text-muted">
              <span className="text-brand-foreground">Highlighted</span> durations are deal prices, not the formula.
            </p>
          )}
          {pricingRules.length > 0 && (
            <p className="mt-tight text-[13px] text-muted">
              {EXAMPLE.label}, {formatDuration(exampleMinutes)} example:{" "}
              <span className="font-mono font-medium text-fg">{formatMoney(bandedExample, currency)}</span>
              {bandedExample !== previewPrice(exampleMinutes) && " (time-band rules applied)"}
            </p>
          )}
          {resources.some((r) => r.rateOverride) && (
            <p className="mt-tight font-mono text-[12px] text-muted">
              {EXAMPLE.label} · {resources.slice(0, 4).map((r) => `${r.name} → ${formatMoney(applyResourceRate(bandedExample, exampleMinutes, r), currency)}`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

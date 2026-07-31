"use client";

import { DurationInput, FormField } from "@/components/ui";
import {
  durationConfigError,
  durationOptions,
  formatDuration,
  formatDurationShort,
  hourlyEquivalent,
  resolveDurationPrice,
} from "@/lib/duration";
import { formatMoney } from "@/lib/format";
import type { DurationConfig, PricingRule } from "@/lib/api";

const majorToMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const minorToMajor = (m: number | undefined) => (m != null && m > 0 ? String(m / 100) : "");

/** The liquid-time editor: min/max/increment, one of three pricing models,
 *  operational toggles, and the MANDATORY live preview of concrete prices. */
export function DurationEngineField({
  value,
  onChange,
  pricingRules = [],
  currency = "BDT",
}: {
  value: DurationConfig;
  onChange: (cfg: DurationConfig) => void;
  pricingRules?: PricingRule[]; // for the banded preview example
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
        <p className="text-[13px] text-neutral-600">
          Bookable durations: <span className="font-mono text-[12px]">{options.map(formatDurationShort).join(" · ")}</span>
        </p>
      )}

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[12px] text-neutral-600">How is it priced?</span>
        <div className="flex flex-wrap gap-tight">
          {([
            { v: "hourly", label: "Hourly rate", helper: "One rate, prorated" },
            { v: "list", label: "Price list", helper: "A price per duration" },
            { v: "base_extension", label: "Base + extension", helper: "First block, then per step" },
          ] as const).map((o) => (
            <button key={o.v} type="button" onClick={() => set("pricingModel", o.v)} className={`flex flex-col items-start rounded-sm border px-comfortable py-tight text-left ${value.pricingModel === o.v ? "border-ink bg-ink text-paper" : "border-neutral-200 bg-white"}`}>
              <span className="text-sm font-medium">{o.label}</span>
              <span className={`text-[11px] ${value.pricingModel === o.v ? "opacity-70" : "text-neutral-400"}`}>{o.helper}</span>
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
            <span className="type-label text-[12px] text-neutral-600">Price per duration</span>
            <button type="button" onClick={fillFromHourly} className="text-[13px] text-ember hover:underline">Fill from hourly rate</button>
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

      <div className="grid gap-section sm:grid-cols-3">
        <FormField label="Must end by closing" variant="toggle" checked={value.mustEndByClose} onChange={(e) => set("mustEndByClose", (e.target as HTMLInputElement).checked)} help="Off: bookings can run past close (night turf)." />
        <DurationInput label="Walk-in rounding" value={value.walkInRoundMinutes} min={5} step={5} onChange={(n) => set("walkInRoundMinutes", n)} chips={[5, 10, 15]} help='"Start now" rounds to this.' />
        <DurationInput label="Lead time" value={value.leadTimeMinutes} onChange={(n) => set("leadTimeMinutes", n)} chips={[0, 15, 30]} help="Minimum notice before start." />
      </div>

      {/* The mandatory preview — concrete numbers before saving. */}
      {!err && options.length > 0 && (
        <div className="rounded-sm border border-ink bg-white p-section">
          <p className="type-label text-[11px] text-neutral-400">Preview</p>
          <p className="mt-inline font-mono text-[13px]">
            Bookable: {options.map((d) => `${formatDurationShort(d)} ${formatMoney(previewPrice(d), currency)}`).join(" · ")}
          </p>
          {pricingRules.length > 0 && (
            <p className="mt-tight text-[13px] text-neutral-600">
              {EXAMPLE.label}, {formatDuration(exampleMinutes)} example:{" "}
              <span className="font-mono font-medium text-ink">{formatMoney(bandedExample, currency)}</span>
              {bandedExample !== previewPrice(exampleMinutes) && " (time-band rules applied)"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

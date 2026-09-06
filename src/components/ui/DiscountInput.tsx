"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

export type DiscountMode = "percent" | "amount";

/** Read a number a human typed: strips %, ৳ and spaces. */
export function parseDiscount(raw: string): number | null {
  const cleaned = raw.replace(/[%৳,\s]/g, "");
  if (!cleaned) return 0;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * A discount that can be a percentage OR money off.
 *
 * "Ten percent" and "take two hundred off" are both things a manager says,
 * and only one of them was expressible. The mode is a visible switch rather
 * than clever parsing of the number, because a cashier typing 200 must never
 * have to wonder whether the till read it as 200% — and the line underneath
 * always resolves the choice into the other unit, so whichever way it was
 * entered, both parties can see the money.
 */
export function DiscountInput({
  mode,
  onMode,
  value,
  onChange,
  base,
  currency,
  chips = [5, 10, 15],
  label,
  compact,
  className,
}: {
  mode: DiscountMode;
  onMode: (m: DiscountMode) => void;
  /** Percent (0–100) when mode is percent, otherwise a Minor amount. */
  value: number;
  onChange: (v: number) => void;
  /** What the discount comes off, for resolving one unit into the other. */
  base: number;
  currency: string;
  chips?: number[];
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<{ of: number; text: string } | null>(null);
  const shown = mode === "percent" ? String(value) : String(value / 100);
  const text = draft && draft.of === value ? draft.text : shown;
  const [error, setError] = useState<string | null>(null);

  const commit = (raw: string) => {
    const n = parseDiscount(raw);
    if (n == null) {
      setError(`Couldn't read "${raw}" — type a number.`);
      return;
    }
    setError(null);
    onChange(mode === "percent" ? Math.min(100, n) : Math.min(base, Math.round(n * 100)));
  };

  /** The same discount said the other way round, so the money is never hidden
   *  behind a percentage nor the percentage behind an amount. */
  const off = mode === "percent" ? Math.round((base * value) / 100) : Math.min(base, value);
  const asPct = base > 0 ? (off / base) * 100 : 0;

  const h = compact ? "h-10" : "h-12";

  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      {label && <span className="type-label text-[12px] text-muted">{label}</span>}

      <div className="flex items-center gap-tight">
        <div className="flex shrink-0 overflow-hidden rounded-sm border border-line">
          {(["percent", "amount"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => { onMode(m); setDraft(null); setError(null); }}
              className={cn(h, "w-12 text-sm font-medium", mode === m ? "bg-ember text-white" : "bg-card")}
            >
              {m === "percent" ? "%" : "৳"}
            </button>
          ))}
        </div>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => setDraft({ of: value, text: e.target.value })}
          onBlur={() => commit(text)}
          onKeyDown={(e) => { if (e.key === "Enter") { commit(text); (e.target as HTMLInputElement).blur(); } }}
          className={cn(h, "min-w-0 flex-1 rounded-sm border bg-card px-comfortable text-right font-mono text-sm outline-none", error ? "border-danger" : "border-line focus:border-ember")}
        />
      </div>

      {mode === "percent" && (
        <div className="flex flex-wrap gap-tight">
          {[0, ...chips].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setDraft(null); setError(null); onChange(c); }}
              className={cn(
                compact ? "h-9" : "h-11",
                "min-w-12 flex-1 rounded-sm border px-tight text-[13px] font-medium",
                value === c ? "border-ember bg-ember/10 text-brand-foreground" : "border-line bg-card active:bg-ember/10",
              )}
            >
              {c === 0 ? "None" : `${c}%`}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : off > 0 ? (
        <p className="text-[12px] text-muted">
          {mode === "percent"
            ? `= ${formatMoney(off, currency)} off`
            : `= ${asPct.toFixed(asPct % 1 === 0 ? 0 : 1)}% off`}
        </p>
      ) : null}
    </div>
  );
}

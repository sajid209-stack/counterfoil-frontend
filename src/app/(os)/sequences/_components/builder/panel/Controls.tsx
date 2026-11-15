"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Button, Chip, SegmentedControl, Select, controlClass } from "@/components/ui";
import { CONDITION_FIELDS, CONDITION_META, blankCondition, conditionSentence, spanWords, type ConditionField, type SequenceCondition } from "@/lib/sequences";
import { useBuilder } from "../context";

type Unit = "min" | "hr" | "day";
const PER: Record<Unit, number> = { min: 1, hr: 60, day: 1440 };
/** The biggest unit a length is a whole number of: 2880 is "2 days", 90 is "90 min". */
const unitOf = (minutes: number): Unit => (minutes > 0 && minutes % 1440 === 0 ? "day" : minutes > 0 && minutes % 60 === 0 ? "hr" : "min");

/**
 * A length of time as people say it: a number and a unit. The kit's duration
 * field counts in hours and minutes, which is right for a slot and wrong for
 * "2 days before" — it would read "48 hr". Chips fill the field.
 */
export function Duration({
  label,
  value,
  onChange,
  min,
  max,
  step = 15,
  chips,
  help,
}: {
  label: string;
  value: number;
  onChange: (minutes: number) => void;
  min: number;
  max: number;
  step?: number;
  chips: number[];
  help?: string;
}) {
  const { ts, tb } = useBuilder();
  const id = useId();
  // The unit the owner chose wins over the one the number implies, so typing
  // "90" in minutes does not jump to another unit half-way through.
  const [picked, setPicked] = useState<Unit | null>(null);
  const unit = picked ?? unitOf(value);
  const clamp = (m: number) => Math.min(max, Math.max(min, Math.round(m)));
  const units = (["min", "hr", "day"] as const).filter((u) => PER[u] <= max && (u !== "min" || step < 60));
  const shown = value / PER[unit];
  return (
    <div className="flex flex-col gap-tight">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="flex items-center gap-tight">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          value={Number.isInteger(shown) ? shown : Number(shown.toFixed(1))}
          onChange={(e) => onChange(clamp((Number(e.target.value) || 0) * PER[unit]))}
          className={`${controlClass()} w-24 min-w-0`}
        />
        <SegmentedControl
          size="sm"
          aria-label={tb("unit.label")}
          value={unit}
          onChange={(u) => {
            const next = u as Unit;
            setPicked(next);
            // Keep the number the owner typed and change what it counts.
            onChange(clamp(Math.max(1, Math.round(shown)) * PER[next]));
          }}
          options={units.map((u) => ({ value: u, label: tb(`unit.${u}`) }))}
        />
      </div>
      <div className="flex flex-wrap gap-tight">
        {chips
          .filter((c) => c >= min && c <= max)
          .map((c) => (
            <Chip
              key={c}
              selected={c === value}
              onClick={() => {
                setPicked(null);
                onChange(c);
              }}
            >
              {spanWords(ts, c)}
            </Chip>
          ))}
      </div>
      {help && <p className="text-sm text-muted">{help}</p>}
    </div>
  );
}

/** One "only if" line: what, how, how many. */
export function ConditionRow({ cond, onChange, onRemove, lead = "onlyIf" }: { cond: SequenceCondition; onChange: (c: SequenceCondition) => void; onRemove?: () => void; lead?: "onlyIf" | "iff" }) {
  const { ts, tb } = useBuilder();
  const id = useId();
  const meta = CONDITION_META[cond.field];
  const setField = (f: string) => onChange({ ...blankCondition(f as ConditionField), id: cond.id });
  return (
    <div className="flex flex-col gap-inline">
      <div className="flex flex-wrap items-center gap-tight">
        <Select
          aria-label={tb("cond.field")}
          value={cond.field}
          onChange={setField}
          options={CONDITION_FIELDS.map((f) => ({ value: f, label: ts(`onlyIf.${f}.name`) }))}
          className="min-w-0 flex-1 basis-40"
        />
        {meta.type === "choice" ? (
          <Select
            aria-label={tb("cond.value")}
            value={String(cond.value)}
            onChange={(v) => onChange({ ...cond, value: v })}
            options={(meta.options ?? []).map((o) => ({ value: o, label: ts(`choice.${o}`) }))}
            className="min-w-0 flex-1 basis-40"
          />
        ) : (
          <>
            <Select
              aria-label={tb("cond.op")}
              value={cond.op === "atMost" ? "atMost" : "atLeast"}
              onChange={(v) => onChange({ ...cond, op: v as "atLeast" | "atMost" })}
              options={[
                { value: "atLeast", label: ts("op.atLeast") },
                { value: "atMost", label: ts("op.atMost") },
              ]}
              className="min-w-0 basis-32"
            />
            <div className="flex min-w-0 basis-28 items-center gap-inline">
              {meta.type === "money" && <span className="text-sm text-muted">৳</span>}
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                aria-label={tb("cond.number")}
                value={meta.type === "money" ? Number(cond.value) / 100 : Number(cond.value)}
                onChange={(e) => {
                  const n = Math.max(0, Number(e.target.value) || 0);
                  onChange({ ...cond, value: meta.type === "money" ? Math.round(n * 100) : Math.round(n) });
                }}
                className={`${controlClass()} w-full min-w-0`}
              />
            </div>
          </>
        )}
        {onRemove && (
          <Button size="icon" variant="tertiary" aria-label={tb("cond.remove")} onClick={onRemove} icon={<X size={16} strokeWidth={1.5} aria-hidden />} />
        )}
      </div>
      <p className="text-sm text-muted">{conditionSentence(ts, cond, lead)}</p>
    </div>
  );
}

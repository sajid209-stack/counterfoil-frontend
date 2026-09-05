"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration, parseDuration } from "@/lib/duration";
import { Field } from "./Field";

/** A duration field a human can type into: `90`, `1:30`, `1h30`, `1.5` all
 *  normalise to 1 hr 30 min. Steppers adjust by `step`; quick chips FILL the
 *  field, they never limit what can be typed. Value is minutes. */
export function DurationInput({
  label,
  value,
  onChange,
  step = 15,
  min = 0,
  chips,
  help,
  error,
  required,
  disabled,
  className,
}: {
  label?: string;
  value: number; // minutes
  onChange: (minutes: number) => void;
  step?: number;
  min?: number;
  chips?: number[]; // quick-fill shortcuts, minutes
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(formatDuration(value));
  const [focused, setFocused] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Reflect external changes when not mid-edit.
  useEffect(() => {
    if (!focused) setText(formatDuration(value));
  }, [value, focused]);

  const commit = (raw: string) => {
    const parsed = parseDuration(raw);
    if (parsed == null) {
      setParseError(`Couldn't read "${raw}" — try "90", "1:30" or "1h30".`);
      setText(formatDuration(value));
      return;
    }
    setParseError(null);
    const next = Math.max(min, parsed);
    onChange(next);
    setText(formatDuration(next));
  };

  const nudge = (dir: 1 | -1) => {
    const next = Math.max(min, value + dir * step);
    setParseError(null);
    onChange(next);
    setText(formatDuration(next));
  };

  const border = error || parseError ? "border-danger focus-within:border-danger" : "border-line focus-within:border-inverse";

  return (
    <Field label={label} help={help} error={error ?? parseError ?? undefined} required={required} htmlFor={id} className={className}>
      <div className={cn("flex h-11 items-stretch overflow-hidden rounded-sm border bg-card transition-colors duration-quick", border, disabled && "bg-subtle")}>
        <input
          id={id}
          type="text"
          inputMode="text"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => { setFocused(true); e.target.select(); }}
          onBlur={(e) => { setFocused(false); commit(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            if (e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
            if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1); }
          }}
          onWheel={(e) => { if (focused) { e.preventDefault(); nudge(e.deltaY < 0 ? 1 : -1); } }}
          className="w-full bg-transparent px-comfortable font-mono text-sm outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        <div className="flex flex-col border-l border-line">
          <button type="button" tabIndex={-1} aria-label="More" disabled={disabled} onClick={() => nudge(1)} className="flex h-1/2 w-8 items-center justify-center text-faint hover:text-fg active:bg-line"><ChevronUp size={13} strokeWidth={1.5} /></button>
          <button type="button" tabIndex={-1} aria-label="Less" disabled={disabled} onClick={() => nudge(-1)} className="flex h-1/2 w-8 items-center justify-center border-t border-line text-faint hover:text-fg active:bg-line"><ChevronDown size={13} strokeWidth={1.5} /></button>
        </div>
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-inline">
          {chips.map((c) => (
            <button key={c} type="button" disabled={disabled} onClick={() => { setParseError(null); onChange(c); setText(formatDuration(c)); }} className={cn("h-7 rounded-xs border px-tight font-mono text-[12px] transition-colors duration-quick", value === c ? "border-inverse bg-inverse text-inverse-fg" : "border-line text-muted hover:border-inverse")}>
              {formatDuration(c)}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

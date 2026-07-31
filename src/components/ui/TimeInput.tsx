"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseTimeOfDay } from "@/lib/duration";
import { toMinutes, toTime } from "@/lib/schedule";
import { Field } from "./Field";

/** A time-of-day field a human can type into: `930`, `9:30`, `1830`, `6:30p`
 *  all normalise to "HH:MM". Steppers adjust by `step` minutes; any minute is
 *  typable. Value is a 24h "HH:MM" string. */
export function TimeInput({
  label,
  value,
  onChange,
  step = 15,
  help,
  error,
  required,
  disabled,
  className,
}: {
  label?: string;
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  step?: number;
  help?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);

  const commit = (raw: string) => {
    const parsed = parseTimeOfDay(raw);
    if (parsed == null) {
      setParseError(`Couldn't read "${raw}" — try "9:30", "1830" or "6:30p".`);
      setText(value);
      return;
    }
    setParseError(null);
    onChange(parsed);
    setText(parsed);
  };

  const nudge = (dir: 1 | -1) => {
    const next = toTime((toMinutes(value) + dir * step + 1440) % 1440);
    setParseError(null);
    onChange(next);
    setText(next);
  };

  const border = error || parseError ? "border-danger focus-within:border-danger" : "border-neutral-200 focus-within:border-ink";

  return (
    <Field label={label} help={help} error={error ?? parseError ?? undefined} required={required} htmlFor={id} className={className}>
      <div className={cn("flex h-11 items-stretch overflow-hidden rounded-sm border bg-white transition-colors duration-quick", border, disabled && "bg-neutral-50")}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
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
          className="w-full bg-transparent px-comfortable font-mono text-sm outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
        />
        <div className="flex flex-col border-l border-neutral-200">
          <button type="button" tabIndex={-1} aria-label="Later" disabled={disabled} onClick={() => nudge(1)} className="flex h-1/2 w-8 items-center justify-center text-neutral-400 hover:text-ink active:bg-neutral-200"><ChevronUp size={13} strokeWidth={1.5} /></button>
          <button type="button" tabIndex={-1} aria-label="Earlier" disabled={disabled} onClick={() => nudge(-1)} className="flex h-1/2 w-8 items-center justify-center border-t border-neutral-200 text-neutral-400 hover:text-ink active:bg-neutral-200"><ChevronDown size={13} strokeWidth={1.5} /></button>
        </div>
      </div>
    </Field>
  );
}

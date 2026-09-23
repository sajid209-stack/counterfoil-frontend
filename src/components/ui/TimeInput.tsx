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

  /* An inset ring, not a border: a border takes two pixels out of the
     44px box, and the steppers inside it were left 42px tall on a phone. */
  const border = error || parseError ? "ring-danger focus-within:ring-danger" : "ring-line focus-within:ring-inverse";

  /* The floor is on the OUTER box, and it is the control's own rather than the
     caller's to get wrong: below md the two nudges are 44px squares each, so a
     caller asking for 7rem left about 24px for the field and the time simply
     vanished. min-width beats width, so a narrow caller reserves the room in
     the layout instead of overflowing it. */
  return (
    <Field label={label} help={help} error={error ?? parseError ?? undefined} required={required} htmlFor={id} className={cn("min-w-[9.5rem] md:min-w-0", className)}>
      <div className={cn("flex h-11 items-stretch overflow-hidden rounded-sm bg-card ring-1 ring-inset transition-colors duration-quick", border, disabled && "bg-subtle")}>
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
          className="w-full bg-transparent px-comfortable text-sm tabular-nums outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        {/* Two stacked half-height nudges suit a pointer; a thumb needs each
            one a full 44px square, so below md they sit side by side. */}
        <div className="flex flex-row-reverse border-l border-line md:flex-col">
          <button type="button" tabIndex={-1} aria-label="Later" disabled={disabled} onClick={() => nudge(1)} className="flex h-full w-11 items-center justify-center text-muted hover:text-fg active:bg-line md:h-1/2 md:w-8"><ChevronUp size={13} strokeWidth={1.5} /></button>
          <button type="button" tabIndex={-1} aria-label="Earlier" disabled={disabled} onClick={() => nudge(-1)} className="flex h-full w-11 items-center justify-center border-r border-line text-muted hover:text-fg active:bg-line md:h-1/2 md:w-8 md:border-r-0 md:border-t"><ChevronDown size={13} strokeWidth={1.5} /></button>
        </div>
      </div>
    </Field>
  );
}

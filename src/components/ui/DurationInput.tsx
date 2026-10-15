"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatDuration, parseDuration } from "@/lib/duration";
import { Field, controlShellClass } from "./Field";

/** A duration field a human can type into: `90`, `1:30`, `1h30`, `1.5` all
 *  normalise to 1 hr 30 min. Steppers adjust by `step`; quick chips FILL the
 *  field, they never limit what can be typed. Value is minutes.
 *
 *  Use it for any length of time an operator sets (a booking's length, a
 *  buffer, a cut-off). For a time of day use TimeInput. */
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
  const t = useTranslations("common");
  /* What the person is typing, while they are typing it. `null` means "not
     editing": the field then simply shows the real value, so an external change
     is reflected with no effect that sets state. */
  const [draft, setDraft] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const text = draft ?? formatDuration(value);

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = parseDuration(raw);
    if (parsed == null) {
      setParseError(t("ui.durationParseError", { raw }));
      return;
    }
    setParseError(null);
    onChange(Math.max(min, parsed));
  };

  const nudge = (dir: 1 | -1) => {
    const next = Math.max(min, value + dir * step);
    setParseError(null);
    if (draft !== null) setDraft(formatDuration(next));
    onChange(next);
  };

  return (
    <Field label={label} help={help} error={error ?? parseError ?? undefined} required={required} htmlFor={id} className={className}>
      {/* The shared control chrome, as a shell: the steppers live inside the
          box, so the box (not the input) wears the edge and the focus ring. */}
      <div data-focus-host="" className={cn(controlShellClass(!!(error || parseError), true), "items-stretch overflow-hidden", disabled && "bg-subtle")}>
        <input
          id={id}
          type="text"
          inputMode="text"
          value={text}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            if (e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
            if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1); }
          }}
          onWheel={(e) => { if (draft !== null) { e.preventDefault(); nudge(e.deltaY < 0 ? 1 : -1); } }}
          className="w-0 min-w-0 flex-1 bg-transparent px-comfortable text-base tabular-nums placeholder:text-faint disabled:cursor-not-allowed"
        />
        {/* Side by side and full height below md, where a thumb needs 44px;
            stacked for a pointer. Same as TimeInput. */}
        <div className="flex flex-row-reverse border-l border-line md:flex-col">
          <button type="button" tabIndex={-1} aria-label={t("ui.more")} disabled={disabled} onClick={() => nudge(1)} className="flex h-full w-11 items-center justify-center text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg active:bg-secondary-active md:h-1/2 md:w-8"><ChevronUp size={13} strokeWidth={1.5} /></button>
          <button type="button" tabIndex={-1} aria-label={t("ui.less")} disabled={disabled} onClick={() => nudge(-1)} className="flex h-full w-11 items-center justify-center border-r border-line text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg active:bg-secondary-active md:h-1/2 md:w-8 md:border-r-0 md:border-t"><ChevronDown size={13} strokeWidth={1.5} /></button>
        </div>
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-inline">
          {chips.map((c) => (
            <button key={c} type="button" disabled={disabled} onClick={() => { setParseError(null); setDraft(null); onChange(c); }} className={cn("h-11 min-w-11 rounded-xs border px-tight text-xs tabular-nums transition-colors duration-quick md:h-7 md:min-w-0", value === c ? "border-transparent bg-ember-solid text-on-solid hover:bg-ember-hover active:bg-ember-active" : "border-line text-muted hover:border-strong hover:bg-muted-wash hover:text-fg")}>
              {formatDuration(c)}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

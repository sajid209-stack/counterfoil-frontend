"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { parseTimeOfDay } from "@/lib/duration";
import { toMinutes, toTime } from "@/lib/schedule";
import { controlCls } from "./SettingsKit";

/**
 * A compact time of day for rows of them — opening hours, seven days, two
 * times each.
 *
 * The shared TimeInput carries a label block and 22px stepper arrows, which is
 * right for one time on a form and wrong fourteen times down a phone: the
 * arrows are too small to hit and the labels repeat the day. This is the same
 * forgiving parse ("930", "6:30p", "1830") in a 44px field, with the arrow keys
 * still nudging by a quarter hour. What was typed is kept, marked, until it
 * reads as a time — a field that silently snaps back hides the mistake.
 */
export function TimeField({
  value,
  onChange,
  label,
  invalid,
  step = 15,
}: {
  value: string;
  onChange: (time: string) => void;
  /** Accessible name — "Opens on Monday". */
  label: string;
  invalid?: boolean;
  step?: number;
}) {
  // null while the field shows the saved value; the raw text while typing.
  const [text, setText] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);

  const commit = (raw: string) => {
    const parsed = parseTimeOfDay(raw);
    if (parsed == null) {
      setUnread(true);
      return;
    }
    setUnread(false);
    setText(null);
    onChange(parsed);
  };

  const nudge = (dir: 1 | -1) => {
    setUnread(false);
    setText(null);
    onChange(toTime((toMinutes(value) + dir * step + 1440) % 1440));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      aria-invalid={invalid || unread || undefined}
      value={text ?? value}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(e.currentTarget.value);
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudge(1);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          nudge(-1);
        }
      }}
      // controlCls carries w-full, and cn does not merge conflicting utilities —
      // left in, w-full won and every time stretched across its row, stacking a
      // day's two times three lines high. The field sizes to a time instead.
      className={cn(controlCls(invalid || unread).replace("w-full", ""), "w-[5.5rem] px-tight text-center tabular-nums")}
    />
  );
}

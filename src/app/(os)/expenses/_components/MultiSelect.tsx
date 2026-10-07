"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MultiOption<V extends string> {
  value: V;
  label: string;
  icon?: LucideIcon;
}

/**
 * A filter that takes several answers: a button that says what is chosen, and
 * a short list of real checkboxes under it.
 *
 * Real checkboxes, not styled divs, so a keyboard gets Tab and Space and a
 * screen reader gets "checked" for free. Nothing chosen means everything — the
 * button then carries just the filter's name, so a narrowed list never looks
 * like the whole one: a chosen filter turns the button orange-edged and names
 * its choice ("Category: Rent") or counts them ("Category · 3").
 */
export function MultiSelect<V extends string>({
  label,
  options,
  value,
  onChange,
  clearLabel,
  className,
}: {
  label: string;
  options: MultiOption<V>[];
  value: V[];
  onChange: (next: V[]) => void;
  clearLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const chosen = options.filter((o) => value.includes(o.value));
  const text = chosen.length === 0 ? label : chosen.length === 1 ? `${label}: ${chosen[0].label}` : `${label} · ${chosen.length}`;
  const toggle = (v: V) => onChange(value.includes(v) ? value.filter((x) => x !== v) : options.map((o) => o.value).filter((x) => x === v || value.includes(x)));

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          const r = trigger.current?.getBoundingClientRect();
          if (r) setAlignEnd(r.left + 288 > window.innerWidth);
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-tight rounded-sm border bg-card px-comfortable text-left text-[13px] font-medium outline-none transition-colors duration-quick focus-visible:ring-2 focus-visible:ring-ink md:h-9 md:w-auto",
          chosen.length > 0 ? "border-ember bg-ember/10 text-fg" : "border-line text-fg hover:border-inverse",
        )}
      >
        <span className="min-w-0 truncate">{text}</span>
        <ChevronDown size={15} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn("absolute top-[calc(100%+4px)] z-40 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-card py-inline shadow-lg", alignEnd ? "right-0" : "left-0")}
        >
          <ul>
            {options.map((o) => {
              const on = value.includes(o.value);
              const Icon = o.icon;
              return (
                <li key={o.value}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-comfortable px-comfortable text-[13px] text-fg transition-colors duration-quick hover:bg-muted-wash md:min-h-9">
                    <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="peer sr-only" />
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-xs border border-strong bg-card text-brand-foreground transition-colors duration-quick peer-focus-visible:ring-2 peer-focus-visible:ring-ink",
                        on && "border-ember bg-ember/10",
                      )}
                    >
                      {on && <Check size={14} strokeWidth={2.5} />}
                    </span>
                    {Icon && <Icon size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {value.length > 0 && (
            <div className="border-t border-hairline p-inline">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex h-11 w-full items-center justify-center rounded-sm text-[13px] font-medium text-brand-foreground hover:bg-muted-wash md:h-9"
              >
                {clearLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

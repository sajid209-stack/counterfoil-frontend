"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

/** The id Tabs gives the tab for `value`, given the strip's `id`. */
/* A value may be anything ("this week"); an id may not contain spaces. */
const slug = (v: string) => v.replace(/[^\w-]/g, "_");
export const tabId = (id: string, value: string) => `${id}-tab-${slug(value)}`;
/** The id the panel for `value` must carry for the tab's aria-controls to land. */
export const tabPanelId = (id: string, value: string) => `${id}-panel-${slug(value)}`;

/**
 * Spread this on the element that shows the active tab's content:
 * `<div {...tabPanelProps(id, value)}>…</div>`. It gives the panel its
 * `role="tabpanel"`, the id the tab points at, a name from the tab, and a tab
 * stop so a keyboard user can reach content that has no focusable child.
 */
export function tabPanelProps(id: string, value: string) {
  return {
    role: "tabpanel" as const,
    id: tabPanelId(id, value),
    "aria-labelledby": tabId(id, value),
    tabIndex: 0,
  };
}

/**
 * Navigation between related content in ONE page — Details / Pricing / History.
 *
 * Use Tabs for sections of a single record, SegmentedControl for switching how
 * the same data is viewed, and real links for moving between pages.
 *
 * Controlled: the caller renders the active panel; Tabs owns the strip.
 * The full ARIA tabs pattern — `tablist` / `tab`, roving tabindex (one tab
 * stop; Tab moves into the panel), `aria-selected`, and Left/Right/Home/End
 * moving AND selecting (the panels are already in memory, so selection follows
 * focus). Pass `id` and spread `tabPanelProps(id, value)` on the panel to
 * complete the wiring (`aria-controls` is only emitted when there is a panel to
 * point at).
 *
 * `variant="underline"` (default) is a quiet rule with a 2px bar under the
 * current tab; `variant="pill"` is a row of soft pills for a strip that sits
 * inside a card or a toolbar and has no rule to continue.
 */
export function Tabs({
  items,
  value,
  onChange,
  className,
  variant = "underline",
  id,
  panelId,
  "aria-label": ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  variant?: "underline" | "pill";
  /** Base id for the tab/panel pair. Pair with `tabPanelProps(id, value)`. */
  id?: string;
  /** Override where a tab's `aria-controls` points — a single shared panel
   *  (string) or a panel per tab (function). Defaults to `tabPanelId(id, value)`
   *  when `id` is given, and is omitted otherwise. */
  panelId?: string | ((value: string) => string);
  "aria-label"?: string;
}) {
  const auto = useId();
  const base = id ?? auto;

  const controls = (v: string) =>
    typeof panelId === "function" ? panelId(v) : (panelId ?? (id ? tabPanelId(id, v) : undefined));

  const enabled = items.filter((it) => !it.disabled);
  // One tab stop: the selected tab, or the first enabled one if none matches.
  const stop = items.some((it) => it.value === value && !it.disabled) ? value : enabled[0]?.value;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key) || enabled.length === 0) return;
    const current = (e.target as HTMLElement).closest("[role=tab]")?.getAttribute("data-tab-value");
    const at = enabled.findIndex((it) => it.value === current);
    const from = at >= 0 ? at : Math.max(0, enabled.findIndex((it) => it.value === value));
    let next = from;
    if (e.key === "ArrowRight") next = (from + 1) % enabled.length;
    else if (e.key === "ArrowLeft") next = (from - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else next = enabled.length - 1;
    e.preventDefault();
    const target = enabled[next];
    onChange(target.value);
    e.currentTarget.querySelector<HTMLElement>(`[data-tab-value="${CSS.escape(target.value)}"]`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      // A tab strip cannot wrap — a tab on a second row reads as a different
      // control — so on a narrow screen it scrolls instead. Five tabs with
      // counts ran 17–71px past the edge at 390px and the last tab was simply
      // unreachable on a phone.
      className={cn(
        "flex gap-inline overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        variant === "underline" && "border-b border-hairline",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            id={tabId(base, it.value)}
            data-tab-value={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={controls(it.value)}
            tabIndex={it.value === stop ? 0 : -1}
            disabled={it.disabled}
            onClick={() => onChange(it.value)}
            // The strip scrolls, which clips an outline drawn outside the
            // button; drawn inside, the global ring is never eaten.
            data-focus-inset=""
            className={cn(
              "shrink-0 whitespace-nowrap text-sm transition-colors duration-quick ease-counterfoil disabled:cursor-not-allowed disabled:opacity-50",
              variant === "underline"
                ? cn(
                    "-mb-px h-11 border-b-2 px-comfortable md:h-10",
                    active
                      ? "border-inverse font-medium text-fg"
                      : // An unselected tab is a control you are meant to read
                        // and click, not a disabled one: `muted`, never `faint`.
                        "border-transparent text-muted hover:text-fg",
                  )
                : cn(
                    "h-11 rounded-control px-comfortable md:h-9",
                    active ? "bg-muted-wash font-medium text-fg" : "text-muted hover:bg-muted-wash hover:text-fg",
                  ),
            )}
          >
            {it.label}
            {it.count != null && (
              <span className="ml-inline text-xs tabular-nums text-muted">{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

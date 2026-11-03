"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { eventDays, spansDays, type EventLineupEntry } from "@/lib/api/events";
import { formatClockRange } from "@/lib/format";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, dayGroups, isRoute, programmeOf, sidesOf, timeLabel, type DayGroup } from "./helpers";

const LINE = "1px solid var(--pg-line)";

/**
 * Programme: what happens and when. Day tabs when the event has days (the
 * label, the date and that day's hours); rows with a fixed time column that
 * never wraps; fixtures ("A vs B") set on one line, left-aligned under the same
 * column as every other row; and, on the Journey look, a vertical route.
 */
export function ProgrammeSection() {
  const ctx = usePage();
  const entries = programmeOf(ctx);
  if (entries.length === 0) return null;
  return (
    <Section id="schedule" title={ctx.labels.schedule}>
      <ProgrammeBody entries={entries} />
    </Section>
  );
}

/** The programme's body, shared with the Lineup section on a sports or travel
 *  page, where the line-up IS the running order. */
export function ProgrammeBody({ entries }: { entries: EventLineupEntry[] }) {
  const ctx = usePage();
  const groups = dayGroups(ctx, entries);
  if (isRoute(ctx)) return <RouteList groups={groups} />;
  if (groups.length < 2) return <Rows entries={groups[0]?.entries ?? []} />;
  return <DayTabs groups={groups} />;
}

/* ── rows ────────────────────────────────────────────────────────────── */

function Rows({ entries }: { entries: EventLineupEntry[] }) {
  const t = useTranslations("storefront");
  return (
    <ol className="m-0 list-none p-0">
      {entries.map((e, i) => {
        const sides = sidesOf(e.name);
        const time = timeLabel(e.at);
        /* A clock time never wraps; a word ("Evening") may. */
        const clock = /\d{1,2}:\d{2}/.test(time);
        return (
          <li
            key={e.id}
            className="grid items-baseline gap-x-3 py-4 sm:gap-x-4"
            style={{ gridTemplateColumns: "84px minmax(0, 1fr)", borderTop: i ? LINE : "none" }}
          >
            <span
              className="text-[14px] font-semibold leading-6 sm:text-[15px]"
              style={{ color: "var(--pg-ink)", fontVariantNumeric: "tabular-nums", whiteSpace: clock ? "nowrap" : undefined }}
            >
              {time}
            </span>
            <div className="min-w-0">
              {/* A fixture is one line of text, so both sides share a baseline
                  and start under the time column; it wraps at the spaces between
                  words, and "vs" is held to the word after it so it never ends
                  a line on its own. */}
              <p className="text-[16px] font-semibold leading-6" style={{ overflowWrap: "break-word" }}>
                {sides ? (
                  <>
                    {sides[0]}
                    <span className="pg-muted mx-1.5 text-[13px] font-medium">{t("pg.sec.vs")}</span>
                    {"\u00A0"}
                    {sides[1]}
                  </>
                ) : (
                  e.name
                )}
              </p>
              {clean(e.role) && (
                <p className="pg-meta mt-0.5" style={{ overflowWrap: "break-word" }}>
                  {e.role}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Each day's own hours, keyed like the day groups: "9:00 AM – 9:00 PM" where
 *  the day carries both, the opening time alone where it carries one. */
function dayHours(ev: Parameters<typeof eventDays>[0]): Map<string, string> {
  const out = new Map<string, string>();
  if (!spansDays(ev)) return out;
  for (const d of eventDays(ev)) {
    const from = d.startTime?.trim();
    const to = d.endTime?.trim();
    if (from && to) out.set(d.id, formatClockRange(from, to));
    else if (from) out.set(d.id, timeLabel(from));
  }
  return out;
}

/* ── day tabs ────────────────────────────────────────────────────────── */

function DayTabs({ groups }: { groups: DayGroup[] }) {
  const ctx = usePage();
  const t = useTranslations("storefront");
  const hours = dayHours(ctx.ev);
  const base = useId();
  const [active, setActive] = useState(0);
  const at = Math.min(active, groups.length - 1);

  /* A real tablist: arrows (and Home/End) move AND select, focus follows, and
     only the selected tab is in the tab order — a keyboard user should not tab
     through every day to reach the last. */
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = groups.length;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (i + 1) % n;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (i - 1 + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setActive(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={t("pg.sec.daysLabel")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {groups.map((g, i) => {
          const on = i === at;
          return (
            <button
              key={g.key}
              id={`${base}-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-panel-${i}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              className="flex min-h-12 shrink-0 flex-col items-start justify-center rounded-[var(--ps-radius-control,12px)] px-4 py-1.5 text-left transition-colors motion-reduce:transition-none"
              style={{
                background: on ? "var(--pg-fill)" : "transparent",
                color: on ? "var(--pg-on-fill)" : "var(--pg-fg)",
                border: `1px solid ${on ? "var(--pg-fill)" : "var(--pg-line)"}`,
              }}
            >
              <span className="whitespace-nowrap text-[15px] font-semibold leading-5">{g.label}</span>
              {g.sub && <span className="whitespace-nowrap text-[13px] leading-4">{g.sub}</span>}
              {hours.get(g.key) && (
                <span className="whitespace-nowrap text-[13px] leading-4" style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {hours.get(g.key)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel-${at}`}
        aria-labelledby={`${base}-tab-${at}`}
        tabIndex={0}
        className="mt-2 outline-offset-4"
      >
        {groups[at].entries.length > 0 ? (
          <Rows entries={groups[at].entries} />
        ) : (
          <p className="pg-meta py-4">{t("pg.sec.dayEmpty")}</p>
        )}
      </div>
    </div>
  );
}

/* ── the route (Journey) ─────────────────────────────────────────────── */

function RouteList({ groups }: { groups: DayGroup[] }) {
  return (
    <div className="relative pl-8">
      {/* The line. Days and stops are dots on it. */}
      <div aria-hidden className="absolute bottom-2 left-[7px] top-2 w-0.5" style={{ background: "var(--pg-line)" }} />
      {groups.map((g, gi) => (
        <div key={g.key} className={gi > 0 ? "mt-8" : undefined}>
          {g.label && (
            <div className="relative mb-4 flex flex-wrap items-baseline gap-x-3">
              <span
                aria-hidden
                className="absolute size-4 rounded-full"
                style={{ left: -32, top: 4, background: "var(--pg-fill)", boxShadow: "0 0 0 4px var(--pg-bg)" }}
              />
              <h3 className="text-[16px] font-semibold leading-6">{g.label}</h3>
              {g.sub && <span className="pg-meta">{g.sub}</span>}
            </div>
          )}
          <ol className="m-0 flex list-none flex-col gap-5 p-0">
            {g.entries.map((e) => (
              <li key={e.id} className="relative min-w-0">
                <span
                  aria-hidden
                  className="absolute size-2.5 rounded-full"
                  style={{ left: -29, top: 5, background: "var(--pg-bg)", border: "2px solid var(--pg-ink)", boxShadow: "0 0 0 3px var(--pg-bg)" }}
                />
                {clean(e.at) && (
                  <p className="text-[14px] font-semibold leading-5" style={{ color: "var(--pg-ink)", fontVariantNumeric: "tabular-nums" }}>
                    {timeLabel(e.at)}
                  </p>
                )}
                <p className="text-[16px] font-semibold leading-6" style={{ overflowWrap: "anywhere" }}>
                  {e.name}
                </p>
                {clean(e.role) && (
                  <p className="pg-meta mt-0.5 max-w-[60ch]" style={{ overflowWrap: "anywhere" }}>
                    {e.role}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

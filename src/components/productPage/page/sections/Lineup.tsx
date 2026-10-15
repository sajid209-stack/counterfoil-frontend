"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { EventLineupEntry } from "@/lib/api/events";
import { usePage } from "../context";
import { Section } from "../Section";
import { ProgrammeBody } from "./Programme";
import { clean, isSequence, peopleOf, timeLabel } from "./helpers";

const FIRST = 8;
const LINE = "1px solid var(--pg-line)";
const initial = (name: string) => Array.from(clean(name))[0]?.toUpperCase() ?? "";

/**
 * Lineup — PEOPLE only (sessions never appear here).
 *
 *  - with photos: a portrait grid, 4:5;
 *  - without: a clean list (a neutral disc with the first letter);
 *  - an energetic look without photos: billing by type size, headliner first —
 *    the one claim a grid of equal cards structurally cannot make;
 *  - a sports or travel page: the line-up is a running order, so it is drawn as
 *    the programme (fixtures with a centred "vs", or the route).
 *
 * First eight, then "Show all N".
 */
export function LineupSection() {
  const ctx = usePage();
  const t = useTranslations("storefront");
  const [all, setAll] = useState(false);
  const people = peopleOf(ctx);
  if (people.length === 0) return null;

  if (isSequence(ctx)) {
    return (
      <Section id="lineup" title={ctx.labels.lineup}>
        <ProgrammeBody entries={people} />
      </Section>
    );
  }

  const shown = all ? people : people.slice(0, FIRST);
  const photos = people.some((p) => clean(p.imageUrl));
  const billing = !photos && ctx.look.personality === "energetic";

  return (
    <Section id="lineup" title={ctx.labels.lineup}>
      {photos ? <Portraits people={shown} /> : billing ? <Billing people={shown} /> : <NameList people={shown} />}
      {people.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="pg-btn-secondary mt-6"
        >
          {all ? t("pg.sec.showFewer") : t("pg.sec.showAll", { count: people.length })}
        </button>
      )}
    </Section>
  );
}

/* ── with photos ─────────────────────────────────────────────────────── */

function Portraits({ people }: { people: EventLineupEntry[] }) {
  const { layout } = usePage();
  const cols = layout === "phone" ? 2 : layout === "tablet" ? 3 : 4;
  return (
    <ul className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {people.map((p) => (
        <li key={p.id} className="min-w-0">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl" style={{ background: "var(--pg-surface)", border: LINE }}>
            {clean(p.imageUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element -- local / remote photos; next/image loader config is avoided app-wide (see PROJECT_LOG)
              <img src={p.imageUrl} alt={p.name} width={480} height={600} loading="lazy" decoding="async" className="size-full object-cover" />
            ) : (
              <span aria-hidden className="absolute inset-0 grid place-items-center text-[40px] font-semibold" style={{ color: "var(--pg-muted)" }}>
                {initial(p.name)}
              </span>
            )}
          </div>
          <p className="mt-3 text-[16px] font-semibold leading-6" style={{ overflowWrap: "anywhere" }}>
            {p.name}
          </p>
          {clean(p.role) && <p className="pg-meta" style={{ overflowWrap: "anywhere" }}>{p.role}</p>}
          {clean(p.at) && <span className="pg-chip mt-2">{timeLabel(p.at)}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ── without photos: a clean list ────────────────────────────────────── */

function NameList({ people }: { people: EventLineupEntry[] }) {
  const { layout } = usePage();
  const cols = layout === "phone" ? 1 : 2;
  return (
    <ul className="grid gap-x-10" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {people.map((p) => (
        <li key={p.id} className="flex min-w-0 items-center gap-4 py-3" style={{ borderTop: LINE }}>
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full text-[16px] font-semibold"
            style={{ background: "var(--pg-surface)", border: LINE, color: "var(--pg-fg)" }}
          >
            {initial(p.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold leading-6" style={{ overflowWrap: "anywhere" }}>
              {p.name}
            </p>
            {clean(p.role) && <p className="pg-meta" style={{ overflowWrap: "anywhere" }}>{p.role}</p>}
          </div>
          {clean(p.at) && <span className="pg-chip shrink-0">{timeLabel(p.at)}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ── billing by type size ────────────────────────────────────────────── */

/** Headliner alone and largest; the main support share a line a step down;
 *  everyone after that smaller again. Set in the look's display face, no glow. */
function Billing({ people }: { people: EventLineupEntry[] }) {
  const { look } = usePage();
  const [head, ...rest] = people;
  const support = rest.slice(0, 3);
  const others = rest.slice(3);
  const face = {
    fontFamily: "var(--pg-display)",
    letterSpacing: "var(--pg-title-tracking)",
    textTransform: look.titleCaps ? ("uppercase" as const) : undefined,
    fontWeight: 700,
    overflowWrap: "anywhere" as const,
  };
  const act = (p: EventLineupEntry, size: string, line: number) => (
    <div key={p.id} className="min-w-0">
      <p style={{ ...face, fontSize: size, lineHeight: line }}>{p.name}</p>
      {(clean(p.role) || clean(p.at)) && (
        <p className="pg-meta mt-1">{[clean(p.role), timeLabel(p.at)].filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-8">
      {act(head, "clamp(44px, 7.5vw, 76px)", 1)}
      {support.length > 0 && (
        <div className="flex flex-wrap gap-x-10 gap-y-5">{support.map((p) => act(p, "clamp(26px, 3.6vw, 38px)", 1.1))}</div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-4">{others.map((p) => act(p, "20px", 1.2))}</div>
      )}
    </div>
  );
}

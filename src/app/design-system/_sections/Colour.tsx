"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Notice, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Callout, Code, DocSection, P, SectionHeader, Small, Sub } from "../_components/Doc";
import { contrast, ratioLabel } from "../_components/colour";
import { ModeHex, ModeProbes, useModeVar, type ProbeMode } from "../_components/ModeProbe";
import { Preview, usePreviewVar } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";
import { ACCENT_HEX } from "../_components/brand";

/* ─────────────────────────────────────────────────────────────────────────
   The Counterfoil Color System, as the owner's spec states it.

   Every value on this page is read from the running stylesheet. The light and
   dark columns are read through ModeProbes (an element carrying `.light` and
   one carrying `.dark`), so both modes are on screen at once and neither
   depends on the top bar's switch. The PRIMITIVE names beside each value are
   written here, because a computed colour does not remember which step it
   came from — they are checked against globals.css, and a value that stops
   matching is visible, because the hex beside the name is live.
   ───────────────────────────────────────────────────────────────────────── */

/* Ramp classes are written out in full on purpose: Tailwind only emits a theme
   variable (and so a value to read) when a utility that uses it appears in the
   source, and a swatch drawn with the class doubles as a wiring test. Every
   scale has exactly eleven steps, 50 to 950. */
type Step = readonly [step: string, cls: string];
const BRAND: Step[] = [["50", "bg-brand-50"], ["100", "bg-brand-100"], ["200", "bg-brand-200"], ["300", "bg-brand-300"], ["400", "bg-brand-400"], ["500", "bg-brand-500"], ["600", "bg-brand-600"], ["700", "bg-brand-700"], ["800", "bg-brand-800"], ["900", "bg-brand-900"], ["950", "bg-brand-950"]];
const NEUTRAL: Step[] = [["50", "bg-neutral-50"], ["100", "bg-neutral-100"], ["200", "bg-neutral-200"], ["300", "bg-neutral-300"], ["400", "bg-neutral-400"], ["500", "bg-neutral-500"], ["600", "bg-neutral-600"], ["700", "bg-neutral-700"], ["800", "bg-neutral-800"], ["900", "bg-neutral-900"], ["950", "bg-neutral-950"]];
const GREEN: Step[] = [["50", "bg-green-50"], ["100", "bg-green-100"], ["200", "bg-green-200"], ["300", "bg-green-300"], ["400", "bg-green-400"], ["500", "bg-green-500"], ["600", "bg-green-600"], ["700", "bg-green-700"], ["800", "bg-green-800"], ["900", "bg-green-900"], ["950", "bg-green-950"]];
const AMBER: Step[] = [["50", "bg-amber-50"], ["100", "bg-amber-100"], ["200", "bg-amber-200"], ["300", "bg-amber-300"], ["400", "bg-amber-400"], ["500", "bg-amber-500"], ["600", "bg-amber-600"], ["700", "bg-amber-700"], ["800", "bg-amber-800"], ["900", "bg-amber-900"], ["950", "bg-amber-950"]];
const RED: Step[] = [["50", "bg-red-50"], ["100", "bg-red-100"], ["200", "bg-red-200"], ["300", "bg-red-300"], ["400", "bg-red-400"], ["500", "bg-red-500"], ["600", "bg-red-600"], ["700", "bg-red-700"], ["800", "bg-red-800"], ["900", "bg-red-900"], ["950", "bg-red-950"]];
const BLUE: Step[] = [["50", "bg-blue-50"], ["100", "bg-blue-100"], ["200", "bg-blue-200"], ["300", "bg-blue-300"], ["400", "bg-blue-400"], ["500", "bg-blue-500"], ["600", "bg-blue-600"], ["700", "bg-blue-700"], ["800", "bg-blue-800"], ["900", "bg-blue-900"], ["950", "bg-blue-950"]];

function RampStep({ ramp, step, cls }: { ramp: string; step: string; cls: string }) {
  const value = usePreviewVar(`--color-${ramp}-${step}`);
  return (
    <li className="flex min-w-0 flex-col gap-inline">
      <span aria-hidden className={`${cls} block h-12 rounded-sm border border-line`} />
      <span className="text-xs font-medium text-fg">{step}</span>
      <span className="truncate font-mono text-xs text-muted" title={value || undefined}>
        {value || "—"}
      </span>
    </li>
  );
}

function Ramp({ title, ramp, steps, note }: { title: string; ramp: string; steps: Step[]; note: string }) {
  return (
    <Sub title={title}>
      <Small>{note}</Small>
      <ul className="grid grid-cols-4 gap-tight sm:grid-cols-6 lg:grid-cols-11">
        {steps.map(([step, cls]) => (
          <RampStep key={step} ramp={ramp} step={step} cls={cls} />
        ))}
      </ul>
    </Sub>
  );
}

/* ── A colour, drawn in a fixed mode ──────────────────────────────────── */

/** A swatch of a token in a pinned mode. The outer element carries `.light` or
 *  `.dark`, which re-declares every token on its own subtree, so the fill
 *  resolves in that mode wherever the page itself is. It sits on that mode's
 *  card, so a translucent token (a disabled fill) composites the way it does in
 *  the product. */
function Swatch({
  token,
  mode,
  className,
  textToken,
  opacity,
  ring,
  children,
}: {
  token: string;
  mode: ProbeMode;
  className?: string;
  /** Draws "Aa" in this text token on top of the fill. */
  textToken?: string;
  opacity?: number;
  /** Draws the token as a focus ring instead of a fill. */
  ring?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span aria-hidden className={cn(mode, "relative flex items-center justify-center overflow-hidden rounded-sm border border-line bg-card", className)}>
      {ring ? (
        <span className="h-7 w-7 rounded-sm bg-card" style={{ outline: `2px solid var(${token})`, outlineOffset: 2 }} />
      ) : (
        <>
          <span className="absolute inset-0" style={{ background: `var(${token})`, opacity }} />
          {(children || textToken) && (
            <span className="relative text-md font-semibold" style={textToken ? { color: `var(${textToken})` } : undefined}>
              {children ?? "Aa"}
            </span>
          )}
        </>
      )}
    </span>
  );
}

const ALPHA = /^([a-z]+-\d+) @ (\d+)%$/;

/** Where the printed hex is read from: a translucent token prints its opaque
 *  primitive, because a hex with an alpha channel names no step of any scale. */
function hexVarFor(token: string, label: string): string {
  const a = ALPHA.exec(label);
  return a ? `--color-${a[1]}` : token;
}

/* ── 01–04: the semantic tokens, grouped as the spec groups them ─────── */

interface SpecRow {
  /** The spec's name for the role. */
  spec: string;
  /** Our token(s), without the `--color-` prefix. */
  token: string;
  /** The custom property read for the swatch and the hex. */
  prop: string;
  /** The Tailwind utility. */
  util: string;
  /** Light value's primitive, and dark value's. "white" and "= card" are literal. */
  l: string;
  d: string;
  use: string;
}
interface SpecGroup {
  number: string;
  title: string;
  note?: string;
  rows: SpecRow[];
}

const row = (spec: string, token: string, util: string, l: string, d: string, use: string, prop = `--color-${token.split(",")[0].trim()}`): SpecRow => ({ spec, token, prop, util, l, d, use });

const SPEC: SpecGroup[] = [
  {
    number: "01",
    title: "Content",
    note: "Text and icons. Everything here is read on the page background or on a card.",
    rows: [
      row("foreground", "fg", "text-fg", "neutral-900", "neutral-100", "Body text and headings."),
      row("secondary-foreground", "fg-secondary", "text-fg-secondary", "neutral-700", "neutral-400", "Text on a secondary surface; quieter than foreground, firmer than muted."),
      row("muted-foreground", "muted", "text-muted", "neutral-600", "neutral-500", "Supporting text and metadata."),
      row("disabled-foreground", "faint", "text-faint", "neutral-400", "neutral-700", "Disabled controls and placeholders only. Never content."), // ds-exception: documents the faint token, a name in a table and a labelled sample, not live text
      row("brand / accent-foreground", "brand-foreground", "text-brand-foreground", "brand-700", "brand-300", "Brand text, links, and text on the accent surface."),
      row("success-foreground", "success", "text-success", "green-800", "green-400", "Success text and icons."),
      row("warning-foreground", "warning", "text-warning", "amber-800", "amber-400", "Warning text and icons."),
      row("destructive-foreground", "danger", "text-danger", "red-700", "red-400", "Error and destructive text and icons."),
      row("info-foreground", "info", "text-info", "blue-700", "blue-400", "Informational text and icons. The marketplace axis uses the same family."),
    ],
  },
  {
    number: "02",
    title: "Surfaces",
    note: "Fills, and the container borders that go with a tinted surface.",
    rows: [
      row("background", "surface", "bg-surface", "neutral-50", "neutral-950", "The page ground."),
      row("card", "card", "bg-card", "white", "neutral-900", "Cards and panels."),
      row("popover", "sheet, chrome", "bg-sheet · bg-chrome", "= card", "= card", "Menus, popovers, sheets, the rail and the top bar.", "--color-sheet"),
      row("secondary-surface", "subtle", "bg-subtle", "neutral-100", "neutral-900", "A sunken fill inside a card. In dark it equals the card, so it needs border-line to be seen."),
      row("muted-surface (hover)", "muted-wash", "bg-muted-wash", "neutral-100", "neutral-800", "The hover fill for rows, menu items and quiet buttons."),
      row("accent-surface", "ember-wash", "bg-ember-wash", "brand-50", "brand-950", "A soft selection or highlight: an active nav item, a current row."),
      row("success-surface", "success-wash", "bg-success-wash", "green-50", "green-950", "A container for success: an alert, a callout, a soft badge."),
      row("warning-surface", "warning-wash", "bg-warning-wash", "amber-50", "amber-950", "A container for warning."),
      row("destructive-surface", "danger-wash", "bg-danger-wash", "red-50", "red-950", "A container for an error."),
      row("info-surface", "info-wash", "bg-info-wash", "blue-50", "blue-950", "A container for information."),
      row("marketplace-surface", "market-wash", "bg-market-wash", "blue-50", "blue-950", "The marketplace badge ground. Same family as info."),
      row("accent-border", "ember-line", "border-ember-line", "brand-200", "brand-900", "The edge of an accent container."),
      row("success-border", "success-line", "border-success-line", "green-200", "green-900", "The edge of a success container."),
      row("warning-border", "warning-line", "border-warning-line", "amber-200", "amber-900", "The edge of a warning container."),
      row("destructive-border", "danger-line", "border-danger-line", "red-200", "red-900", "The edge of an error container."),
      row("info-border", "info-line", "border-info-line", "blue-200", "blue-900", "The edge of an info container."),
    ],
  },
  {
    number: "03",
    title: "Interaction",
    note: "The fills and states of controls. States come from the family's own scale: a deeper step in light, a brighter one in dark. Nothing is a faded opacity.",
    rows: [
      row("primary", "ember-solid", "bg-ember-solid", "brand-500", "brand-500", "The primary fill. One per screen. The same orange in both modes."),
      row("primary-foreground", "on-solid", "text-on-solid", "white", "white", "Text on every filled button, badge and mark: white in light and in dark."),
      row("primary-hover", "ember-hover", "bg-ember-hover", "brand-600", "brand-600", "Primary, pointer over."),
      row("primary-active", "ember-active", "bg-ember-active", "brand-700", "brand-700", "Primary, pressed."),
      row("primary-disabled", "ember-disabled", "bg-ember-disabled", "brand-100 @ 60%", "brand-900 @ 40%", "Primary, not available. Text is text-faint."), // ds-exception: documents the faint token, a name in a table and a labelled sample, not live text
      row("secondary", "btn-secondary", "bg-btn-secondary", "white", "neutral-800", "The secondary button: a white control. Text is foreground; the edge is secondary-line; it carries shadow-sm."),
      row("secondary-line", "btn-secondary-line", "border-btn-secondary-line", "neutral-300", "neutral-700", "The firm edge of a secondary button."),
      row("secondary-hover", "btn-secondary-hover", "bg-btn-secondary-hover", "neutral-100", "neutral-700", "Secondary, pointer over."),
      row("secondary-active", "btn-secondary-active", "bg-btn-secondary-active", "neutral-200", "neutral-600", "Secondary, pressed."),
      row("destructive", "danger-soft", "bg-danger-soft", "red-50", "red-950", "The destructive button: a soft red, with text-danger-soft-fg (red-800 / red-200) and border-danger-line. Delete, refund, cancel."),
      row("destructive-hover", "danger-soft-hover", "bg-danger-soft-hover", "red-100", "red-900", "Destructive, pointer over."),
      row("destructive-active", "danger-soft-active", "bg-danger-soft-active", "red-200", "red-800", "Destructive, pressed."),
      row("solid red (mark)", "danger-solid", "bg-danger-solid", "red-600", "red-600", "A loud red mark with text-on-solid: a verdict, a badge, a closed session. Not a button."),
      row("solid red hover", "danger-hover", "bg-danger-hover", "red-700", "red-700", "Hover of a solid red mark (pressed is danger-active, red-800)."),
      row("solid red disabled", "danger-disabled", "bg-danger-disabled", "red-100 @ 60%", "red-900 @ 40%", "A disabled solid-red mark. The destructive button itself fades to half strength."),
      row("accent", "ember-wash", "bg-ember-wash", "brand-50", "brand-950", "The accent fill, with text-brand-foreground on it."),
      row("ring, focus-ring", "ring", "ring-ring", "brand-500", "brand-400", "The focus ring, one for every control in both products."),
      row("success (solid)", "success-solid", "bg-success-solid", "green-700", "green-700", "A confirmed fill, with white text-on-solid on it."),
      row("marketplace (solid)", "market-solid", "bg-market-solid", "blue-700", "blue-700", "The marketplace badge, with white text-on-solid on it."),
    ],
  },
  {
    number: "04",
    title: "Structure",
    note: "Lines. A surface change separates before a line does; when a line is needed it is one of these.",
    rows: [
      row("border, input", "line", "border-line", "neutral-200", "neutral-800", "A component's edge and an input's edge."),
      row("divider", "hairline", "border-hairline", "neutral-200", "neutral-800", "The divider between rows."),
      row("border-strong", "strong", "border-strong", "neutral-300", "neutral-700", "The hover edge or an emphasised edge."),
    ],
  },
];

function ModeCell({ r, mode }: { r: SpecRow; mode: ProbeMode }) {
  const label = mode === "light" ? r.l : r.d;
  return (
    <div className="flex items-center gap-tight">
      <Swatch token={r.prop} mode={mode} className="h-8 w-8 shrink-0" />
      <div className="min-w-0">
        <ModeHex name={hexVarFor(r.prop, label)} mode={mode} className="block font-mono text-xs text-fg" />
        <span className="block text-xs text-muted">{label}</span>
      </div>
    </div>
  );
}

function SpecTable({ groups, caption }: { groups: SpecGroup[]; caption: string }) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="max-md:sr-only">
            <tr className="border-b border-hairline text-muted">
              <th scope="col" className="px-card py-tight font-medium">Spec name</th>
              <th scope="col" className="px-card py-tight font-medium">Our token</th>
              <th scope="col" className="px-card py-tight font-medium">Light</th>
              <th scope="col" className="px-card py-tight font-medium">Dark</th>
              <th scope="col" className="px-card py-tight font-medium">Use</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.number + g.title}>
              <tr className="bg-subtle">
                <th scope="colgroup" colSpan={5} className="px-card py-tight text-left text-sm font-semibold text-fg max-md:block">
                  <span className="font-mono">{g.number}</span> · {g.title}
                  {g.note && <span className="ml-tight font-normal text-muted"> {g.note}</span>}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.spec + r.token} className="border-b border-hairline last:border-0 max-md:flex max-md:flex-col max-md:gap-tight max-md:px-card max-md:py-comfortable">
                  <th scope="row" className="px-card py-comfortable text-left align-top font-medium text-fg max-md:p-0">
                    <code className="break-words font-mono text-sm">{r.spec}</code>
                  </th>
                  <td className="px-card py-comfortable align-top max-md:p-0">
                    <code className="block break-words font-mono text-sm text-fg">{r.token}</code>
                    <code className="block break-words font-mono text-xs text-muted">{r.util}</code>
                  </td>
                  <td className="px-card py-comfortable align-top max-md:p-0">
                    <span className="mb-inline block text-xs text-muted md:hidden">Light</span>
                    <ModeCell r={r} mode="light" />
                  </td>
                  <td className="px-card py-comfortable align-top max-md:p-0">
                    <span className="mb-inline block text-xs text-muted md:hidden">Dark</span>
                    <ModeCell r={r} mode="dark" />
                  </td>
                  <td className="px-card py-comfortable align-top text-muted max-md:p-0">{r.use}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

/* Tokens the stylesheet carries that the spec does not name. Live, in the mode
   the top bar picks. */
const EXTRA: TokenRow[] = [
  { group: "Beyond the spec" },
  { name: "--color-ink", utility: "bg-ink", note: "The deepest neutral (neutral-950)." },
  { name: "--color-paper", utility: "bg-paper", note: "The lightest neutral (neutral-50)." },
  { name: "--color-inverse", utility: "bg-inverse", note: "Inverse surface: a tooltip, a dark chip." },
  { name: "--color-inverse-fg", utility: "text-inverse-fg", note: "Text on the inverse surface. Not text-on-solid." },
  { name: "--color-offtime", utility: "bg-offtime", note: "Calendar time that cannot be sold: the page showing through." },
  { name: "--color-ember", utility: "bg-ember", note: "The accent for marks, dots and stripes; the focus ring points at it." },
  { name: "--color-market", utility: "text-market", note: "The marketplace axis: the info blue." },
  { name: "--color-market-solid", utility: "bg-market-solid", note: "The marketplace badge fill." },
];

/* ── Component state tokens ───────────────────────────────────────────── */

interface StateDef {
  state: string;
  token: string;
  l: string;
  d: string;
  /** The text token drawn on the fill. */
  text?: string;
  ring?: boolean;
  opacity?: number;
}
interface Family {
  name: string;
  note: string;
  states: StateDef[];
}

const FAMILIES: Family[] = [
  {
    name: "Primary",
    note: "The brand fill. White on it is 3.50:1 in both modes: AA Large / UI, accepted for controls and never for body text. Dark keeps the same orange and the same white text; hover and pressed darken to brand-600 and brand-700.",
    states: [
      { state: "Default", token: "--color-ember-solid", l: "brand-500", d: "brand-500", text: "--color-on-solid" },
      { state: "Hover", token: "--color-ember-hover", l: "brand-600", d: "brand-600", text: "--color-on-solid" },
      { state: "Active", token: "--color-ember-active", l: "brand-700", d: "brand-700", text: "--color-on-solid" },
      { state: "Disabled", token: "--color-ember-disabled", l: "brand-100 @ 60%", d: "brand-900 @ 40%", text: "--color-faint" },
      { state: "Focus ring", token: "--color-ring", l: "brand-500", d: "brand-400", ring: true },
    ],
  },
  {
    name: "Secondary",
    note: "A white control with a firm neutral-300 edge and a small shadow, so it stands off the warm page and off a white card. Text is foreground (16.09:1 on white). In dark it is neutral-800 with a neutral-700 edge. Each state is its own step.",
    states: [
      { state: "Default", token: "--color-btn-secondary", l: "white", d: "neutral-800", text: "--color-fg" },
      { state: "Edge", token: "--color-btn-secondary-line", l: "neutral-300", d: "neutral-700", text: "--color-fg" },
      { state: "Hover", token: "--color-btn-secondary-hover", l: "neutral-100", d: "neutral-700", text: "--color-fg" },
      { state: "Active", token: "--color-btn-secondary-active", l: "neutral-200", d: "neutral-600", text: "--color-fg" },
      { state: "Focus ring", token: "--color-ring", l: "brand-500", d: "brand-400", ring: true },
    ],
  },
  {
    name: "Destructive",
    note: "A soft red, never a solid one that could pass for the orange primary: red-50 with red-800 text and a red-200 edge in light; red-950 with red-200 text and a red-900 edge in dark. Disabled fades the whole control to half strength.",
    states: [
      { state: "Default", token: "--color-danger-soft", l: "red-50", d: "red-950", text: "--color-danger-soft-fg" },
      { state: "Edge", token: "--color-danger-line", l: "red-200", d: "red-900", text: "--color-danger" },
      { state: "Hover", token: "--color-danger-soft-hover", l: "red-100", d: "red-900", text: "--color-danger-soft-fg" },
      { state: "Active", token: "--color-danger-soft-active", l: "red-200", d: "red-800", text: "--color-danger-soft-fg" },
      { state: "Disabled", token: "--color-danger-soft", l: "red-50", d: "red-950", text: "--color-danger-soft-fg", opacity: 0.5 },
      { state: "Focus ring", token: "--color-ring", l: "brand-500", d: "brand-400", ring: true },
    ],
  },
];

function StateTile({ s, mode }: { s: StateDef; mode: ProbeMode }) {
  const label = mode === "light" ? s.l : s.d;
  const shown = s.opacity ? `${label}, ${Math.round(s.opacity * 100)}% opacity` : label;
  return (
    <li className="flex min-w-0 flex-col gap-inline">
      <Swatch token={s.token} mode={mode} textToken={s.text} opacity={s.opacity} ring={s.ring} className="h-14 w-full" />
      <span className="text-sm font-medium text-fg">{s.state}</span>
      <ModeHex name={hexVarFor(s.token, label)} mode={mode} className="font-mono text-xs text-fg" />
      <span className="text-xs text-muted">{shown}</span>
    </li>
  );
}

function StateFamily({ f }: { f: Family }) {
  return (
    <Sub title={f.name}>
      <Small>{f.note}</Small>
      <div className="card-surface flex flex-col gap-section p-card">
        {(["light", "dark"] as const).map((mode) => (
          <div key={mode} className="flex flex-col gap-tight">
            <p className="text-sm font-semibold text-fg">{mode === "light" ? "Light" : "Dark"}</p>
            <ul className="grid grid-cols-2 gap-tight sm:grid-cols-5">
              {f.states.map((s) => (
                <StateTile key={s.state} s={s} mode={mode} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Sub>
  );
}

/* ── Status and feedback ──────────────────────────────────────────────── */

interface Status {
  key: "success" | "warning" | "destructive" | "info";
  title: string;
  /** The token stem: --color-success, --color-danger… */
  stem: string;
  Icon: LucideIcon;
  tone: "success" | "warning" | "danger" | "info";
  fg: [string, string];
  surface: [string, string];
  border: [string, string];
  /** Tailwind classes, written out in full so the utilities are emitted. */
  textCls: string;
  surfaceCls: string;
  borderCls: string;
  line: string;
}

const STATUSES: Status[] = [
  { key: "success", title: "Success", stem: "success", Icon: CircleCheck, tone: "success", fg: ["green-800", "green-400"], surface: ["green-50", "green-950"], border: ["green-200", "green-900"], textCls: "text-success", surfaceCls: "bg-success-wash", borderCls: "border-success-line", line: "Payment received." },
  { key: "warning", title: "Warning", stem: "warning", Icon: TriangleAlert, tone: "warning", fg: ["amber-800", "amber-400"], surface: ["amber-50", "amber-950"], border: ["amber-200", "amber-900"], textCls: "text-warning", surfaceCls: "bg-warning-wash", borderCls: "border-warning-line", line: "Only 3 places left." },
  { key: "destructive", title: "Destructive", stem: "danger", Icon: CircleAlert, tone: "danger", fg: ["red-700", "red-400"], surface: ["red-50", "red-950"], border: ["red-200", "red-900"], textCls: "text-danger", surfaceCls: "bg-danger-wash", borderCls: "border-danger-line", line: "This ticket was refused." },
  { key: "info", title: "Info", stem: "info", Icon: Info, tone: "info", fg: ["blue-700", "blue-400"], surface: ["blue-50", "blue-950"], border: ["blue-200", "blue-900"], textCls: "text-info", surfaceCls: "bg-info-wash", borderCls: "border-info-line", line: "Tickets are sent by SMS." },
];

const STATUS_GROUPS: SpecGroup[] = STATUSES.map((s, i) => ({
  number: String(i + 1).padStart(2, "0"),
  title: s.title,
  rows: [
    row(`${s.key}-foreground`, s.stem, s.textCls, s.fg[0], s.fg[1], "Text and icons. Used directly, with no container."),
    row(`${s.key}-surface`, `${s.stem}-wash`, s.surfaceCls, s.surface[0], s.surface[1], "The container fill, when the message needs one."),
    row(`${s.key}-border`, `${s.stem}-line`, s.borderCls, s.border[0], s.border[1], "The container edge, always paired with the surface."),
  ],
}));

/** Both examples for every status, drawn in one fixed mode. */
function StatusExamples({ mode }: { mode: ProbeMode }) {
  return (
    <div className={cn(mode, "flex flex-col gap-section rounded-md border border-line bg-card p-card text-fg")}>
      <p className="text-sm font-semibold">{mode === "light" ? "Light" : "Dark"}</p>
      <div className="grid gap-section sm:grid-cols-2">
        <div className="flex flex-col gap-tight">
          <p className="text-xs text-muted">Text-only</p>
          {STATUSES.map((s) => (
            <p key={s.key} className={cn("flex items-center gap-tight text-sm font-medium", s.textCls)}>
              <s.Icon size={16} strokeWidth={1.75} aria-hidden />
              {s.line}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-tight">
          <p className="text-xs text-muted">With surface</p>
          {STATUSES.map((s) => (
            <div key={s.key} className={cn("flex items-start gap-tight rounded-sm border p-tight text-sm", s.surfaceCls, s.borderCls)}>
              <s.Icon size={16} strokeWidth={1.75} aria-hidden className={cn("mt-0.5 shrink-0", s.textCls)} />
              <div className="min-w-0">
                <p className={cn("font-semibold", s.textCls)}>{s.title}</p>
                <p className="text-fg">{s.line}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Visual hierarchy and the text colour system ──────────────────────── */

function HierarchyPanel({ mode }: { mode: ProbeMode }) {
  return (
    <div className="flex min-w-0 flex-col gap-inline">
      <p className="text-sm font-semibold text-fg">{mode === "light" ? "Light" : "Dark"}</p>
      <div className={cn(mode, "flex flex-col gap-tight rounded-md border border-line bg-surface p-comfortable text-fg")}>
        <p className="text-xs text-muted">Page · bg-surface</p>
        <div className="flex flex-col gap-tight rounded-md border border-line bg-card p-comfortable">
          <p className="text-xs text-muted">Card · bg-card (popovers, sheets and the rail are the same)</p>
          <p className="text-md font-semibold text-fg">Winter Exhibition Pass</p>
          <p className="text-sm text-fg-secondary">Valid for 7 days from the first visit.</p>
          <p className="text-sm text-muted">Updated 5 days ago</p>
          <div className="mt-inline flex flex-col gap-tight">
            <span className="rounded-sm border border-line bg-subtle px-comfortable py-tight text-sm text-fg-secondary">Secondary surface · bg-subtle (needs border-line in dark)</span>
            <span className="rounded-sm bg-muted-wash px-comfortable py-tight text-sm text-fg">Hover fill · bg-muted-wash</span>
            <span className="rounded-sm bg-ember-wash px-comfortable py-tight text-sm text-brand-foreground">Accent surface · bg-ember-wash</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Content tokens, in order of emphasis. */
const TEXTS: Array<{ token: string; cls: string; role: string }> = [
  { token: "fg", cls: "text-fg", role: "Foreground" },
  { token: "fg-secondary", cls: "text-fg-secondary", role: "Secondary" },
  { token: "muted", cls: "text-muted", role: "Muted" },
  { token: "brand-foreground", cls: "text-brand-foreground", role: "Brand and links" },
  { token: "success", cls: "text-success", role: "Success" },
  { token: "warning", cls: "text-warning", role: "Warning" },
  { token: "danger", cls: "text-danger", role: "Destructive" },
  { token: "info", cls: "text-info", role: "Info" },
  { token: "faint", cls: "text-faint", role: "Disabled only" }, // ds-exception: documents the faint token, a name in a table and a labelled sample, not live text
];

function TextPanel({ mode }: { mode: ProbeMode }) {
  return (
    <div className="flex min-w-0 flex-col gap-inline">
      <p className="text-sm font-semibold text-fg">{mode === "light" ? "Light" : "Dark"}</p>
      <div className={cn(mode, "flex flex-col gap-tight rounded-md border border-line bg-surface p-comfortable text-fg")}>
        {TEXTS.map((t) => (
          <div key={t.token} className="flex flex-wrap items-baseline justify-between gap-x-section gap-y-inline">
            <p className={cn("text-md", t.cls)}>The quick brown fox</p>
            <p className="font-mono text-xs text-muted">
              {t.role} · {t.token}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Contrast validation matrix ───────────────────────────────────────── */

type Level = { label: string; cls: string };

function levelOf(ratio: number | null, expectFail?: boolean): Level {
  if (ratio == null) return { label: "—", cls: "bg-subtle text-muted" };
  if (ratio >= 7) return { label: "AAA", cls: "bg-success-wash text-success" };
  if (ratio >= 4.5) return { label: "AA", cls: "bg-success-wash text-success" };
  if (ratio >= 3) return { label: "AA Large / UI", cls: "bg-info-wash text-info" };
  return expectFail ? { label: "Disabled only", cls: "bg-warning-wash text-warning" } : { label: "Fails AA", cls: "bg-danger-wash text-danger" };
}

interface PairDef {
  label: string;
  fg: string;
  bg: string;
  note?: string;
  expectFail?: boolean;
}

function PairCell({ d, mode }: { d: PairDef; mode: ProbeMode }) {
  const fg = useModeVar(d.fg, mode);
  const bg = useModeVar(d.bg, mode);
  const ratio = fg && bg ? contrast(fg, bg) : null;
  const lv = levelOf(ratio, d.expectFail);
  return (
    <div className="flex items-center gap-tight">
      <span aria-hidden className={cn(mode, "flex h-9 w-12 shrink-0 items-center justify-center rounded-sm border border-line text-base font-semibold")} style={{ background: `var(${d.bg})`, color: `var(${d.fg})` }}>
        Aa
      </span>
      <div className="min-w-0">
        <span className="block font-mono text-sm tabular-nums text-fg">{ratioLabel(ratio)}</span>
        <span className={cn("inline-flex rounded-full px-tight py-0.5 text-xs font-medium", lv.cls)}>{lv.label}</span>
      </div>
    </div>
  );
}

const onBg = (token: string, label: string, note?: string, expectFail?: boolean): PairDef => ({ label, fg: `--color-${token}`, bg: "--color-surface", note, expectFail });

const CONTENT_PAIRS: PairDef[] = [
  onBg("fg", "foreground"),
  onBg("fg-secondary", "secondary-foreground"),
  onBg("muted", "muted-foreground"),
  onBg("faint", "disabled-foreground", "Disabled controls and placeholders only. Below AA on purpose.", true),
  onBg("brand-foreground", "brand-foreground"),
  onBg("success", "success-foreground"),
  onBg("warning", "warning-foreground"),
  onBg("danger", "destructive-foreground"),
  onBg("info", "info-foreground"),
];

const COMPONENT_PAIRS: PairDef[] = [
  { label: "primary-foreground on primary", fg: "--color-on-solid", bg: "--color-ember-solid", note: `White on ${ACCENT_HEX} is 3.50:1 in both modes: AA Large / UI. Accepted for UI controls only, never for body text.` },
  { label: "foreground on secondary button", fg: "--color-fg", bg: "--color-btn-secondary" },
  { label: "destructive-foreground on destructive button", fg: "--color-danger-soft-fg", bg: "--color-danger-soft" },
  { label: "on-solid on solid red (mark)", fg: "--color-on-solid", bg: "--color-danger-solid" },
  { label: "accent-foreground on accent", fg: "--color-brand-foreground", bg: "--color-ember-wash" },
  { label: "on-solid on success", fg: "--color-on-solid", bg: "--color-success-solid" },
  { label: "on-solid on marketplace", fg: "--color-on-solid", bg: "--color-market-solid" },
];

function PairRows({ title, rows }: { title: string; rows: PairDef[] }) {
  return (
    <tbody>
      <tr className="bg-subtle">
        <th scope="colgroup" colSpan={3} className="px-card py-tight text-left text-sm font-semibold text-fg max-md:block">
          {title}
        </th>
      </tr>
      {rows.map((d) => (
        <tr key={d.label} className="border-b border-hairline last:border-0 max-md:flex max-md:flex-col max-md:gap-tight max-md:px-card max-md:py-comfortable">
          <th scope="row" className="px-card py-comfortable text-left align-top max-md:p-0">
            <span className="block text-sm font-medium text-fg">{d.label}</span>
            {d.note && <span className="block max-w-prose text-xs font-normal text-muted">{d.note}</span>}
          </th>
          <td className="px-card py-comfortable align-top max-md:p-0">
            <span className="mb-inline block text-xs text-muted md:hidden">Light</span>
            <PairCell d={d} mode="light" />
          </td>
          <td className="px-card py-comfortable align-top max-md:p-0">
            <span className="mb-inline block text-xs text-muted md:hidden">Dark</span>
            <PairCell d={d} mode="dark" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/* ── Charts ───────────────────────────────────────────────────────────── */

const CHARTS: TokenRow[] = [
  { group: "Categorical, in a fixed order" },
  { name: "--chart-1", note: "brand-500" },
  { name: "--chart-2", note: "blue-600 · blue-500 in dark" },
  { name: "--chart-3", note: "amber-700 · amber-600 in dark" },
  { name: "--chart-4", note: "green-600" },
  { group: "Spending breakdown" },
  { name: "--chart-cat-1" },
  { name: "--chart-cat-2" },
  { name: "--chart-cat-3" },
  { name: "--chart-cat-4", note: "red-600 · red-500 in dark." },
  { name: "--chart-cat-other", note: "Reads as “the rest”." },
  { group: "Heat, one hue by quantile" },
  { name: "--heat-1" },
  { name: "--heat-2" },
  { name: "--heat-3" },
  { name: "--heat-4" },
  { name: "--heat-5" },
  { name: "--heat-6" },
];

export function ColourSection() {
  return (
    <ModeProbes>
      <SectionHeader slug="colour" />

      <DocSection id="architecture" title="Three layers">
        <P>
          A layer only ever points at the one beneath it. <strong className="font-semibold">Primitives</strong> are the raw scales, named by value and never used in components.{" "}
          <strong className="font-semibold">Semantic roles</strong> are named by purpose, point at a primitive and change with the mode.{" "}
          <strong className="font-semibold">Component tokens</strong> (a state of a control) change with the product. This page is the Counterfoil Color System: the scales, the roles in four groups, the state tokens, status and feedback, the contrast check and the two hierarchies.
        </P>
      </DocSection>

      <DocSection id="primitives" title="Primitive tonal scales">
        <P>Six scales, each exactly eleven steps from 50 to 950. They are fixed values: they do not change with mode or product, so they are shown on the page itself rather than in a preview.</P>
        <Ramp title="Brand / Primary" ramp="brand" steps={BRAND} note={`Hue 18° · High chroma · Derived from ${ACCENT_HEX}`} />
        <Ramp title="Neutral / Warm Gray" ramp="neutral" steps={NEUTRAL} note="Hue 40° · 3% saturation · Brand-compatible structural palette" />
        <Ramp title="Success / Green" ramp="green" steps={GREEN} note="Hue 142° · Positive actions, confirmations" />
        <Ramp title="Warning / Amber" ramp="amber" steps={AMBER} note="Hue 38° · Caution, attention needed" />
        <Ramp title="Destructive / Red" ramp="red" steps={RED} note="Hue 0° · Errors, destructive actions, critical alerts" />
        <Ramp title="Info / Blue" ramp="blue" steps={BLUE} note="Hue 217° · Informational, neutral guidance" />
      </DocSection>

      <DocSection id="roles" title="Semantic tokens">
        <P>
          Four groups: content, surfaces, interaction and structure. Each row gives the spec&rsquo;s name, our token and its Tailwind utility, and the light and dark value with the primitive it points at. The hex beside each swatch is read from the stylesheet, light and dark at once; the primitive name is the step it should equal.
        </P>
        <ModeLegend />
        <SpecTable groups={SPEC} caption="Semantic colour tokens, light and dark" />
        <TokenTable rows={EXTRA} sample="colour" label="Tokens the spec does not name" />
        <Callout title="One orange, used with care">
          <strong className="font-semibold">{ACCENT_HEX}</strong> is brand-500. As a fill it carries white text at 3.50:1, which the Color System accepts for UI controls (buttons, chips, badges) as AA Large / UI, and never for body text. Brand-coloured text at body size is <Code>brand-foreground</Code> (brand-700 in light, brand-300 in dark). The focus ring is <Code>ring</Code>, the same orange.
        </Callout>
      </DocSection>

      <DocSection id="states" title="Component state tokens">
        <P>Primary, secondary and destructive, each through default, hover, active, disabled and the focus ring, in light and dark. Primary is white on orange, secondary a white control with an edge, destructive a soft red. A state is the next step of the same scale: it never fades the fill with opacity.</P>
        {FAMILIES.map((f) => (
          <StateFamily key={f.name} f={f} />
        ))}
      </DocSection>

      <DocSection id="status" title="Status and feedback">
        <P>
          Success, warning, destructive and info each have a foreground, a surface and a border. Text-only feedback uses the foreground token alone. A container uses the surface and the border, with the foreground token on the icon and the title.
        </P>
        <SpecTable groups={STATUS_GROUPS} caption="Status tokens, light and dark" />
        <Sub title="Text-only and with surface">
          <div className="grid gap-section lg:grid-cols-2">
            <StatusExamples mode="light" />
            <StatusExamples mode="dark" />
          </div>
        </Sub>
        <Sub title="In the kit">
          <Small>
            <Code>StatusPill</Code> is the soft badge: the surface and the foreground, no border. <Code>Notice</Code> is the inline message. Both follow the switches in the top bar.
          </Small>
          <Preview label="StatusPill and Notice" innerClassName="flex flex-col gap-section">
            <div className="flex flex-wrap items-center gap-tight">
              <StatusPill tone="success">Paid</StatusPill>
              <StatusPill tone="warning">Part paid</StatusPill>
              <StatusPill tone="danger">Refused</StatusPill>
              <StatusPill tone="info">Marketplace</StatusPill>
            </div>
            <div className="grid gap-tight md:grid-cols-2">
              <Notice tone="success" title="Payment received">The ticket was sent.</Notice>
              <Notice tone="warning" title="Almost full">Only 3 places left.</Notice>
              <Notice tone="danger" title="Could not refund">Ask a manager to approve it.</Notice>
              <Notice tone="info" title="Tickets by SMS">Guests get a text with a QR code.</Notice>
            </div>
          </Preview>
        </Sub>
      </DocSection>

      <DocSection id="contrast" title="Contrast validation">
        <P>
          Computed live from the tokens, in both modes at once. The level badge is the WCAG one: <strong className="font-semibold">AAA</strong> from 7:1, <strong className="font-semibold">AA</strong> from 4.5:1, and <strong className="font-semibold">AA Large / UI</strong> from 3:1, which is enough for large text and for the edges and fills of controls but not for body text.
        </P>
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Contrast of content and component pairs, light and dark</caption>
              <thead className="max-md:sr-only">
                <tr className="border-b border-hairline text-muted">
                  <th scope="col" className="px-card py-tight font-medium">Pair</th>
                  <th scope="col" className="px-card py-tight font-medium">Light</th>
                  <th scope="col" className="px-card py-tight font-medium">Dark</th>
                </tr>
              </thead>
              <PairRows title="Content tokens on the page background" rows={CONTENT_PAIRS} />
              <PairRows title="Foreground on its own fill" rows={COMPONENT_PAIRS} />
            </table>
          </div>
        </div>
        <Small>Disabled-foreground is below AA on purpose: it marks what cannot be used, so it is never the only carrier of content.</Small>
      </DocSection>

      <DocSection id="hierarchy" title="Visual hierarchy">
        <P>
          Surfaces step from the page, to the card, to a sunken or highlighted fill inside it. Content steps from foreground, to secondary, to muted. In dark the secondary surface equals the card, so a sunken fill is told apart by its border.
        </P>
        <div className="grid gap-section lg:grid-cols-2">
          <HierarchyPanel mode="light" />
          <HierarchyPanel mode="dark" />
        </div>
      </DocSection>

      <DocSection id="text-colours" title="The text colour system">
        <P>One sentence in every content token, light and dark, in the order of emphasis. Disabled-foreground comes last because it is not for reading.</P>
        <div className="grid gap-section lg:grid-cols-2">
          <TextPanel mode="light" />
          <TextPanel mode="dark" />
        </div>
      </DocSection>

      <DocSection id="data-viz" title="Chart and heat palettes">
        <P>Every chart colour is a step of one of the scales. The slots are assigned in a fixed order and never cycled, and every chart ships direct labels.</P>
        <TokenTable rows={CHARTS} sample="colour" label="Chart and heat tokens" />
      </DocSection>
    </ModeProbes>
  );
}

function ModeLegend() {
  return (
    <Small>
      Light and dark are drawn here whatever the top bar says; the OS/POS switch does not change a colour, only shapes. A translucent token (a disabled fill) prints the primitive it is cut from.
    </Small>
  );
}

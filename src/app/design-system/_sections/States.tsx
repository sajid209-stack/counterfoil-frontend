"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { Button, Card, Chip, ChoiceCard, DataTable, SegmentedControl, Select, controlClass, type Column } from "@/components/ui";
import type { ButtonVariant } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Callout, Code, DocSection, P, SectionHeader, Small } from "../_components/Doc";
import { Preview, ThemeQuad } from "../_components/Preview";

/*
 * Interaction states, drawn with the real recipes.
 *
 * Rest, Selected, Disabled, Loading and Invalid are PROPS of the real
 * components, so those cells are the components themselves. Hover cannot be
 * frozen — it is a pointer state — so its cell is the live component, labelled
 * "point at it". Focus and Pressed are shown by applying the documented
 * recipe to the real component: the global focus ring is
 * `outline 2px solid var(--color-ring)` at a 2px offset (the utilities below
 * are exactly that), and the press is the scale each component declares.
 */
const FOCUS = "outline outline-2 outline-offset-2 outline-ring";
const PRESS_BUTTON = "scale-[0.98]";

function Cell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-inline">
      <dt className="text-xs font-medium text-muted">
        {label}
        {hint && <span className="font-normal"> · {hint}</span>}
      </dt>
      <dd className="flex min-h-11 min-w-0 items-center">{children}</dd>
    </div>
  );
}
const NA = <span className="text-sm text-muted">—</span>;

function Block({ title, note, cols = "lg:grid-cols-6", children }: { title: string; note?: string; cols?: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-card">
      <h3 className="text-md font-semibold">{title}</h3>
      {note && <p className="text-sm text-muted">{note}</p>}
      <dl className={cn("mt-comfortable grid grid-cols-2 gap-comfortable sm:grid-cols-3", cols)}>{children}</dl>
    </div>
  );
}

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "tertiary", "destructive", "link"];
const TOGGLES = new Set<ButtonVariant>(["secondary", "tertiary"]);

function ButtonStates() {
  return (
    <Block title="Button" note="Each variant draws its own states. Selected is the toggle button (aria-pressed)." cols="lg:grid-cols-7">
      {VARIANTS.flatMap((v) => [
        <div key={`${v}-h`} className="col-span-full -mb-inline mt-tight font-mono text-sm text-muted first:mt-0">
          {v}
        </div>,
        <Cell key={`${v}-rest`} label="Rest">
          <Button variant={v}>Save</Button>
        </Cell>,
        <Cell key={`${v}-hover`} label="Hover" hint="point at it">
          <Button variant={v}>Save</Button>
        </Cell>,
        <Cell key={`${v}-focus`} label="Focus">
          <Button variant={v} className={FOCUS}>
            Save
          </Button>
        </Cell>,
        <Cell key={`${v}-pressed`} label="Pressed">
          <Button variant={v} className={PRESS_BUTTON}>
            Save
          </Button>
        </Cell>,
        <Cell key={`${v}-sel`} label="Selected">
          {TOGGLES.has(v) ? (
            <Button variant={v} selected>
              Save
            </Button>
          ) : (
            NA
          )}
        </Cell>,
        <Cell key={`${v}-dis`} label="Disabled">
          <Button variant={v} disabled>
            Save
          </Button>
        </Cell>,
        <Cell key={`${v}-load`} label="Loading">
          <Button variant={v} loading>
            Save
          </Button>
        </Cell>,
      ])}
    </Block>
  );
}

function FieldStates() {
  const [v, setV] = useState("fort");
  const opts = [
    { value: "fort", label: "Lalbagh Fort" },
    { value: "museum", label: "Ahsan Manzil Museum" },
  ];
  return (
    <>
      <Block title="Text field" note="The shared control chrome: controlClass(). Focus adds an ember edge on top of the global ring." cols="lg:grid-cols-5">
        <Cell label="Rest">
          <input aria-label="Rest" className={controlClass()} placeholder="Value" />
        </Cell>
        <Cell label="Hover" hint="point at it">
          <input aria-label="Hover" className={controlClass()} placeholder="Value" />
        </Cell>
        <Cell label="Focus">
          <input aria-label="Focus" className={cn(controlClass(), "border-ember", FOCUS)} defaultValue="Ayesha" />
        </Cell>
        <Cell label="Invalid">
          <input aria-label="Invalid" aria-invalid className={controlClass(true)} defaultValue="abc" />
        </Cell>
        <Cell label="Disabled">
          <input aria-label="Disabled" className={controlClass()} disabled defaultValue="Locked" />
        </Cell>
      </Block>
      <Block title="Select trigger" note="Counterfoil's own dropdown. Focus and the open state are live: tab to it or press it." cols="lg:grid-cols-5">
        <Cell label="Rest">
          <Select aria-label="Rest" value={v} onChange={setV} options={opts} />
        </Cell>
        <Cell label="Hover" hint="point at it">
          <Select aria-label="Hover" value={v} onChange={setV} options={opts} />
        </Cell>
        <Cell label="Focus / open" hint="tab or press">
          <Select aria-label="Open" value={v} onChange={setV} options={opts} />
        </Cell>
        <Cell label="Invalid">
          <Select aria-label="Invalid" aria-invalid value={v} onChange={setV} options={opts} />
        </Cell>
        <Cell label="Disabled">
          <Select aria-label="Disabled" disabled value={v} onChange={setV} options={opts} />
        </Cell>
      </Block>
    </>
  );
}

function ChipStates() {
  return (
    <Block title="Chip" note="Selected is the ember-solid fill with a check, so it never depends on colour alone.">
      <Cell label="Rest">
        <Chip>Paid</Chip>
      </Cell>
      <Cell label="Hover" hint="point at it">
        <Chip onClick={() => {}}>Paid</Chip>
      </Cell>
      <Cell label="Focus">
        <Chip onClick={() => {}} className={FOCUS}>
          Paid
        </Chip>
      </Cell>
      <Cell label="Pressed">
        <Chip onClick={() => {}} className={PRESS_BUTTON}>
          Paid
        </Chip>
      </Cell>
      <Cell label="Selected">
        <Chip selected onClick={() => {}}>
          Paid
        </Chip>
      </Cell>
      <Cell label="Disabled">
        <Chip disabled>Paid</Chip>
      </Cell>
    </Block>
  );
}

function SegmentedStates() {
  const [a, setA] = useState("week");
  const [b, setB] = useState("day");
  const opts = [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }];
  return (
    <Block title="SegmentedControl option" note="One tab stop; arrow keys move and select. Selected is a raised card tile." cols="lg:grid-cols-4">
      <Cell label="Rest + selected">
        <SegmentedControl aria-label="Rest" value={a} onChange={setA} options={opts} />
      </Cell>
      <Cell label="Hover" hint="point at an option">
        <SegmentedControl aria-label="Hover" value={a} onChange={setA} options={opts} />
      </Cell>
      <Cell label="Focus" hint="tab to it">
        <SegmentedControl aria-label="Focus" value={b} onChange={setB} options={opts} />
      </Cell>
      <Cell label="Disabled option">
        <SegmentedControl aria-label="Disabled" value={a} onChange={setA} options={[opts[0], { ...opts[1], disabled: true }, opts[2]]} />
      </Cell>
    </Block>
  );
}

interface Row {
  id: string;
  ref: string;
  who: string;
}
const ROWS: Row[] = [
  { id: "1", ref: "CF-001053", who: "Ayesha Siddika" },
  { id: "2", ref: "CF-001052", who: "Rahim Khan" },
  { id: "3", ref: "CF-001051", who: "Tanvir Ahmed" },
];
const COLS: Column<Row>[] = [
  { key: "ref", header: "Reference", mono: true, render: (r) => r.ref },
  { key: "who", header: "Customer", render: (r) => r.who },
];

function RowStates() {
  return (
    <div className="card-surface p-card">
      <h3 className="text-md font-semibold">Table row</h3>
      <p className="text-sm text-muted">Point at a row, tab to one and press Enter, or press and hold. The second row is the selected one (the accent: ember-wash).</p>
      <div className="mt-comfortable overflow-hidden rounded-inner border border-hairline">
        <DataTable columns={COLS} rows={ROWS} getRowId={(r) => r.id} onRowClick={() => {}} isSelected={(r) => r.id === "2"} height="page" />
      </div>
    </div>
  );
}

function CardStates() {
  const body = (t: string) => <p className="text-sm">{t}</p>;
  return (
    <Block title="Interactive card" note="A card that is a link: it lifts on hover and presses in. A plain card has no states." cols="lg:grid-cols-4">
      <Cell label="Rest">
        <Card interactive className="w-full">{body("Winter Pass")}</Card>
      </Cell>
      <Cell label="Hover" hint="point at it">
        <Card interactive className="w-full">{body("Winter Pass")}</Card>
      </Cell>
      <Cell label="Focus">
        <Card interactive tabIndex={0} className={cn("w-full", FOCUS)}>
          {body("Winter Pass")}
        </Card>
      </Cell>
      <Cell label="Pressed">
        <Card interactive className="w-full scale-[0.995]">{body("Winter Pass")}</Card>
      </Cell>
    </Block>
  );
}

/* The rail row's own recipe, copied from the OS Sidebar (it needs a router). */
function RailItem({ current, className, children }: { current?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-comfortable rounded-control px-comfortable text-base font-medium transition-colors duration-quick",
        current ? "bg-ember-wash text-brand-foreground" : "text-muted hover:bg-muted-wash hover:text-fg",
        className,
      )}
    >
      <ReceiptText size={18} strokeWidth={1.5} aria-hidden className={cn("shrink-0", current && "text-ember")} />
      {children}
    </button>
  );
}

function RailStates() {
  return (
    <Block title="Rail / nav item" note="The OS rail's row, drawn from the Sidebar's recipe. Current is the accent: an ember-wash fill, brand-foreground text and an ember icon — no border, no shadow. Hover is muted-wash." cols="lg:grid-cols-4">
      <Cell label="Rest">
        <RailItem>Orders</RailItem>
      </Cell>
      <Cell label="Hover" hint="point at it">
        <RailItem>Orders</RailItem>
      </Cell>
      <Cell label="Focus">
        <RailItem className={FOCUS}>Orders</RailItem>
      </Cell>
      <Cell label="Current (selected)">
        <RailItem current>Orders</RailItem>
      </Cell>
    </Block>
  );
}

function ChoiceStates() {
  const tile = (t: string) => <span className="block px-comfortable py-tight text-sm font-medium">{t}</span>;
  return (
    <Block title="ChoiceCard" note="The selectable card. Selected is a 2px ember ring plus a check, drawn inset so nothing shifts.">
      <Cell label="Rest">
        <ChoiceCard>{tile("Lane 1")}</ChoiceCard>
      </Cell>
      <Cell label="Hover" hint="point at it">
        <ChoiceCard onClick={() => {}}>{tile("Lane 2")}</ChoiceCard>
      </Cell>
      <Cell label="Focus">
        <ChoiceCard className={FOCUS}>{tile("Lane 3")}</ChoiceCard>
      </Cell>
      <Cell label="Pressed">
        <ChoiceCard className="bg-ember-wash">{tile("Lane 4")}</ChoiceCard>
      </Cell>
      <Cell label="Selected">
        <ChoiceCard selected>{tile("Lane 5")}</ChoiceCard>
      </Cell>
      <Cell label="Disabled">
        <ChoiceCard disabled>{tile("Lane 6")}</ChoiceCard>
      </Cell>
    </Block>
  );
}

function Matrix() {
  return (
    <div className="flex flex-col gap-section">
      <ButtonStates />
      <FieldStates />
      <ChipStates />
      <SegmentedStates />
      <RowStates />
      <CardStates />
      <RailStates />
      <ChoiceStates />
    </div>
  );
}

function Compact() {
  return (
    <div className="flex flex-col gap-comfortable">
      <div className="flex flex-wrap items-center gap-tight">
        <Button>Rest</Button>
        <Button className={FOCUS}>Focus</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>
      <div className="flex flex-wrap items-center gap-tight">
        <Button variant="secondary">Rest</Button>
        <Button variant="secondary" selected>
          Selected
        </Button>
        <Chip selected onClick={() => {}}>
          Chip
        </Chip>
      </div>
      <div className="grid gap-tight sm:grid-cols-2">
        <input aria-label="Rest" className={controlClass()} placeholder="Rest" />
        <input aria-label="Invalid" aria-invalid className={controlClass(true)} defaultValue="Invalid" />
      </div>
    </div>
  );
}

const CHANGES: Array<{ state: string; what: React.ReactNode }> = [
  {
    state: "Hover",
    what: (
      <>
        Every hover is a step of the control&rsquo;s own scale, never an opacity. Primary: <Code>ember-hover</Code> (brand-600; brand-300 in dark). Destructive: <Code>danger-hover</Code> (red-700; red-400). Secondary: <Code>secondary-hover</Code> (neutral-200; neutral-800). Tertiary, menu items, rail rows and table rows: <Code>muted-wash</Code>. Link: text to <Code>ember-hover</Code>. Interactive card: <Code>shadow-float</Code>. Fields: border to <Code>strong</Code>. ChoiceCard: an ember edge.
      </>
    ),
  },
  {
    state: "Focus",
    what: (
      <>
        One ring for every focusable element in both products: a <Code>2px solid var(--color-ring)</Code> outline at a <Code>2px</Code> offset, set by the global <Code>:focus-visible</Code> rule. A composite control (an input with a prefix) draws it on its shell; a control a scroller would clip draws it inset. A field also takes an ember edge.
      </>
    ),
  },
  {
    state: "Pressed",
    what: (
      <>
        Button and chip: <Code>scale 0.98</Code>, and the button fill moves one step deeper again: primary <Code>ember-active</Code> (brand-700; brand-500 in dark), destructive <Code>danger-active</Code> (red-800; red-600), secondary <Code>secondary-active</Code> (neutral-300; neutral-700). Interactive card: <Code>scale 0.995</Code>. ChoiceCard: an <Code>ember-wash</Code> fill. Rows: <Code>muted-wash</Code>. Over <Code>duration-quick</Code> (120ms); reduced motion removes the transition.
      </>
    ),
  },
  {
    state: "Selected",
    what: (
      <>
        Chip: <Code>ember-solid</Code> fill, <Code>on-solid</Code> text (white in light, neutral-950 in dark) and a check. SegmentedControl: a raised <Code>card</Code> tile with <Code>shadow-sm</Code>. ChoiceCard: a 2px ember ring and a check. Toggle button: a firmer edge or <Code>muted-wash</Code> fill with <Code>aria-pressed</Code>. Table row and rail row: the accent, <Code>ember-wash</Code> with <Code>brand-foreground</Code> text. Selection is never colour alone.
      </>
    ),
  },
  {
    state: "Disabled",
    what: (
      <>
        Solid buttons (primary, destructive): their own family&rsquo;s tint — <Code>ember-disabled</Code> / <Code>danger-disabled</Code>, the 100 step at 60% (the 900 step at 40% in dark) — with <Code>faint</Code> text. Secondary and the rest: the whole control at <Code>50%</Code> opacity. Fields: a <Code>subtle</Code> fill and <Code>faint</Code> text. The cursor says not-allowed and the press feedback is gone. Say why, nearby.
      </>
    ),
  },
  {
    state: "Loading",
    what: (
      <>
        Button only: the label stays in the layout but invisible, so the width is kept, with a spinner over it. It is also disabled and sets <Code>aria-busy</Code>.
      </>
    ),
  },
  {
    state: "Invalid",
    what: (
      <>
        Fields: a <Code>danger</Code> edge, <Code>aria-invalid</Code>, and a sentence below that <em>replaces</em> the help line and names itself as the control&rsquo;s description.
      </>
    ),
  },
];

export function StatesSection() {
  return (
    <>
      <SectionHeader slug="states" />

      <DocSection id="matrix" title="The matrix">
        <P>
          Every control draws its own rest, hover, focus, pressed, selected, disabled, loading and invalid states, so a page never styles one. Below, each control in every state it has. Rest, selected, disabled, loading and invalid are the component&rsquo;s own props. <strong className="font-semibold">Hover is live</strong> — point at it. Focus and pressed are the documented recipe applied to the real component, because a pointer or keyboard state cannot be held still. Switch OS/POS and Light/Dark in the top bar.
        </P>
        <Preview label="Every control, every state" innerClassName="flex flex-col gap-section">
          <Matrix />
        </Preview>
        <Small>A dash means the control has no such state (a link has no selected state; a field has no pressed one).</Small>
      </DocSection>

      <DocSection id="changes" title="What each state changes">
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">What each interaction state changes</caption>
              <thead className="max-md:sr-only">
                <tr className="border-b border-hairline text-muted">
                  <th scope="col" className="w-32 px-card py-tight font-medium">
                    State
                  </th>
                  <th scope="col" className="px-card py-tight font-medium">
                    What changes
                  </th>
                </tr>
              </thead>
              <tbody>
                {CHANGES.map((c) => (
                  <tr key={c.state} className="border-b border-hairline last:border-0 max-md:flex max-md:flex-col max-md:gap-inline max-md:px-card max-md:py-comfortable">
                    <th scope="row" className="px-card py-comfortable text-left align-top font-medium text-fg max-md:p-0">
                      {c.state}
                    </th>
                    <td className="px-card py-comfortable align-top text-fg max-md:p-0">{c.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Callout title="Where the recipes live">
          They are in the components — <Code>Button</Code>, <Code>controlClass()</Code>, <Code>Chip</Code>, <Code>SegmentedControl</Code>, <Code>ChoiceCard</Code> and the <Code>card-interactive</Code> class — and the focus ring is one rule in <Code>globals.css</Code>. A page does not restate any of it.
        </Callout>
      </DocSection>

      <DocSection id="quad" title="In all four themes">
        <P>The same handful of states in OS and POS, light and dark.</P>
        <ThemeQuad>
          <Compact />
        </ThemeQuad>
      </DocSection>
    </>
  );
}

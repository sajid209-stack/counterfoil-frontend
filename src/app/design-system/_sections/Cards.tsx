"use client";

import { Check, X } from "lucide-react";
import { ActivityList, Button, Card, DataTable, DetailCard, FactGrid, StatusPill, TicketCard, TimelineCard, type ActivityItem, type Column, type Fact, type TicketCardData } from "@/components/ui";
import { Callout, Code, ComponentDoc, DocSection, P, SectionHeader, Small } from "../_components/Doc";
import { Preview, ThemeQuad, useRootPx, usePreviewVar } from "../_components/Preview";
import { TokenTable, type TokenRow } from "../_components/TokenTable";

/** "20px" from a custom property read live in the active preview. */
function Live({ name }: { name: string }) {
  const v = usePreviewVar(name);
  const root = useRootPx();
  const m = /^(-?\d*\.?\d+)rem$/.exec(v);
  const shown = m ? `${parseFloat(m[1]) * root}px` : v;
  return <strong className="font-semibold tabular-nums text-fg">{shown || "—"}</strong>;
}

function Anatomy() {
  return (
    <div className="flex flex-col gap-section">
      <Card
        title="Payment methods"
        actions={
          <Button size="sm" variant="secondary">
            Edit
          </Button>
        }
      >
        <p className="text-sm text-muted">Body. The header carries a title and optional actions; everything inside is padded by the same token.</p>
      </Card>
      <ul className="flex flex-col gap-tight text-sm text-muted">
        <li>
          Padding inside the card: <Live name="--spacing-card" /> (16px under <Code>sm</Code>) — <Code>p-card</Code>.
        </li>
        <li>
          Card title: <Code>text-md font-semibold</Code>. Gap between cards: <Live name="--spacing-section" /> — <Code>gap-section</Code>. Between groups with headings: <Live name="--spacing-major" /> — <Code>gap-major</Code>, with the heading <Live name="--spacing-tight" /> above its card.
        </li>
        <li>
          Corner: <Live name="--radius-card" />. Resting elevation: <Code>--shadow-card</Code>.
        </li>
      </ul>
    </div>
  );
}

const STACK: Array<{ token: string; role: string }> = [
  { token: "--color-surface", role: "The page ground." },
  { token: "--color-card", role: "A card: the one surface content sits on." },
  { token: "--color-subtle", role: "Sunken: a fill inside a card — a group, a chip, an inner frame." },
  { token: "--color-sheet", role: "Floating: a menu, popover, sheet or dialog, lifted by elevation." },
];

function Stack() {
  return (
    <div className="rounded-inner bg-surface p-section text-sm">
      <p className="mb-tight font-medium text-fg">
        Page <span className="font-mono text-xs text-muted">surface</span>
      </p>
      <div className="card-surface p-card">
        <p className="mb-tight font-medium text-fg">
          Card <span className="font-mono text-xs text-muted">card</span>
        </p>
        <div className="rounded-inner bg-subtle p-comfortable">
          <p className="font-medium text-fg">
            Sunken <span className="font-mono text-xs text-muted">subtle</span>
          </p>
          <p className="text-xs text-muted">A fill, not a box: no border.</p>
        </div>
        <div className="relative mt-comfortable">
          <div className="ml-major rounded-sheet bg-sheet p-comfortable shadow-float">
            <p className="font-medium text-fg">
              Sheet <span className="font-mono text-xs text-muted">sheet</span>
            </p>
            <p className="text-xs text-muted">Floating: shadow-float, or a line in dark.</p>
          </div>
        </div>
      </div>
    </div>
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
];
const COLS: Column<Row>[] = [
  { key: "ref", header: "Reference", mono: true, render: (r) => r.ref },
  { key: "who", header: "Customer", render: (r) => r.who },
];

function Variants() {
  return (
    <div className="grid gap-section md:grid-cols-2">
      <Card>
        <p className="text-md font-semibold">Resting</p>
        <p className="text-sm text-muted">The default. Padding p-card.</p>
      </Card>
      <Card interactive>
        <p className="text-md font-semibold">Interactive</p>
        <p className="text-sm text-muted">Lifts on hover (shadow-float), presses in. For a card that is a link.</p>
      </Card>
      <div
        className="rounded-inner p-section"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--color-muted-wash) 0 12px, var(--color-subtle) 12px 24px)" }}
      >
        <Card glass>
          <p className="text-md font-semibold">Glass</p>
          <p className="text-sm text-muted">Translucent and blurred, for a floating panel over a page you keep seeing.</p>
        </Card>
      </div>
      <Card title="Header with actions" actions={<Button size="sm" variant="tertiary">Manage</Button>}>
        <p className="text-sm text-muted">title and actions draw a header row with a hairline under it.</p>
      </Card>
      <Card padding="none" title="Padding none">
        <div className="table-inset">
          <DataTable columns={COLS} rows={ROWS} getRowId={(r) => r.id} height="page" />
        </div>
      </Card>
      <Card>
        <p className="text-md font-semibold">With an inner frame</p>
        <div className="mt-comfortable rounded-inner bg-subtle p-comfortable text-sm">A frame inside a card: rounded-inner, a fill and no border.</div>
      </Card>
    </div>
  );
}

function Nesting() {
  return (
    <div className="flex flex-col gap-section">
      <div className="card-surface p-comfortable">
        <div className="rounded-inner bg-subtle p-comfortable text-sm">
          <div className="rounded-inner bg-card p-tight text-xs text-muted">Card → inner frame → inner frame: one step down at each level.</div>
        </div>
      </div>
      <dl className="grid gap-tight text-sm text-muted sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium">Outer · rounded-card</dt>
          <dd>
            <Live name="--radius-card" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium">Inner · rounded-inner</dt>
          <dd>
            <Live name="--radius-inner" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium">Padding between them</dt>
          <dd>
            <Live name="--spacing-comfortable" />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Sample() {
  return (
    <div className="card-surface p-card">
      <p className="text-md font-semibold">Winter Exhibition Pass</p>
      <p className="text-sm text-muted">A resting card on the page.</p>
      <div className="mt-comfortable rounded-inner bg-subtle p-comfortable text-sm">Inner frame</div>
    </div>
  );
}

/* ── Record cards: DetailCard, FactGrid, TimelineCard, TicketCard ───────────
   The anatomy of the issued-order (ticket) page, drawn from the kit. */
const PRIMARY_FACTS: Fact[] = [
  { key: "type", label: "Ticket type", value: "Winter Exhibition Pass · Adult" },
  { key: "holder", label: "Ticket holder", value: "Ayesha Siddika" },
  { key: "validFor", label: "Valid for", value: "Wednesday 29 July" },
  { key: "used", label: "Used", value: "0 of 1 used" },
];
const SECONDARY_FACTS: Fact[] = [
  { key: "order", label: "Order", value: "CF-2026-001053", href: "/design-system/cards", mono: true },
  { key: "price", label: "Price", value: "৳500.00" },
  { key: "channel", label: "Where sold", value: "Counter" },
  { key: "issued", label: "Issued", value: undefined },
];
const CODE_ITEMS: ActivityItem[] = [
  {
    id: "c2",
    title: "CF-2026-001053-02",
    mono: true,
    status: <StatusPill tone="success">Active</StatusPill>,
    detail: "Re-issued · Replacement · 29 Jul, 4:40 PM · Nadia Islam · Code 2",
    note: "Guest lost their phone.",
  },
  {
    id: "c1",
    title: "CF-2026-001053-01",
    mono: true,
    struck: true,
    status: <StatusPill tone="neutral">Replaced</StatusPill>,
    detail: "Issued · At sale · 29 Jul, 1:05 PM · Nadia Islam · Code 1",
  },
];
const SCAN_ITEMS: ActivityItem[] = [
  {
    id: "s2",
    title: "Refused",
    tone: "danger",
    icon: <X size={15} strokeWidth={2.5} aria-hidden />,
    time: "29 Jul, 5:12 PM · Rahim Khan",
    detail: "This code was replaced by a newer one · CF-2026-001053-01",
  },
  {
    id: "s1",
    title: "Admitted",
    tone: "success",
    icon: <Check size={15} strokeWidth={2.5} aria-hidden />,
    time: "29 Jul, 5:20 PM · Rahim Khan",
  },
];
const STUB: TicketCardData = {
  business: "Lalbagh Heritage Attractions",
  productName: "Winter Exhibition Pass",
  tierName: "Adult",
  indexLabel: "1 of 2",
  fields: [
    { label: "Date", value: "Wed 29 Jul 2026" },
    { label: "Time", value: "10:00 AM – 11:00 AM" },
    { label: "Ticket holder", value: "Ayesha Siddika" },
  ],
  code: "CF-2026-001053-02",
  gateHint: "Present at the gate · scan to check in",
  referenceLabel: "Reservation reference",
};

function RecordFacts() {
  return (
    <DetailCard title="Ticket details">
      <FactGrid facts={PRIMARY_FACTS} tone="primary" />
      <div className="mt-section border-t border-hairline pt-section">
        <FactGrid facts={SECONDARY_FACTS} />
      </div>
    </DetailCard>
  );
}

function RecordTimeline() {
  return (
    <div className="flex flex-col gap-section">
      <TimelineCard title="Ticket codes" description="The codes that open the gate. Only one works at a time." items={CODE_ITEMS} empty="No codes." />
      <TimelineCard title="Check-in history" items={SCAN_ITEMS} empty="Never scanned." />
      <TimelineCard title="Check-in history (empty)" items={[]} empty="Never scanned." />
    </div>
  );
}

function RecordSample() {
  return (
    <DetailCard title="Check-in history">
      <ActivityList items={SCAN_ITEMS} />
    </DetailCard>
  );
}

function StubDemo() {
  return (
    <div className="mx-auto max-w-sm">
      <TicketCard data={STUB} />
    </div>
  );
}

const TOKENS: TokenRow[] = [
  { name: "--radius-card", utility: "rounded-card", note: "12 in OS, 18 in POS." },
  { name: "--radius-inner", utility: "rounded-inner", note: "3 in OS, 14 in POS." },
  { name: "--shadow-card", utility: "shadow-card", note: "A ring and a lift in light; a 1px line in dark." },
  { name: "--shadow-float", utility: "shadow-float", note: "A floating layer." },
];

export function CardsSection() {
  return (
    <>
      <SectionHeader slug="cards" />

      <DocSection id="anatomy" title="Anatomy">
        <P>
          A card is the one surface content sits on. It is <Code>card-surface</Code> — the card colour, the product&rsquo;s card radius and its resting elevation — and it is drawn by the <Code>Card</Code> component, never typed by hand.
        </P>
        <Preview label="Card with title and actions">
          <Anatomy />
        </Preview>
      </DocSection>

      <DocSection id="surfaces" title="The stack of surfaces">
        <P>
          Four surfaces, each a role. Depth comes from the surface changing before a border appears: a card is lighter than the page, a sunken fill is a step below the card, and a sheet floats above with elevation.
        </P>
        <Preview label="Page → card → sunken → sheet">
          <Stack />
        </Preview>
        <TokenTable rows={STACK.map((s) => ({ name: s.token, note: s.role }))} sample="colour" label="The surfaces" />
        <Small>In dark, the card and the sunken fill are different steps on purpose — a sunken fill that equalled the card would vanish.</Small>
      </DocSection>

      <DocSection id="variants" title="Variants">
        <Preview label="Card variants">
          <Variants />
        </Preview>
      </DocSection>

      <DocSection id="nesting" title="Nested corners">
        <P>
          <strong className="font-semibold">Inner corner = outer corner − the gap between them.</strong> A frame inside a card steps one size down (<Code>rounded-card</Code> → <Code>rounded-inner</Code>), and one more inside that. The three values read live below, for the active product.
        </P>
        <Preview label="Outer → inner → inner">
          <Nesting />
        </Preview>
      </DocSection>

      <DocSection id="os-pos" title="OS and POS, light and dark">
        <P>
          OS: a 12px corner, a ring and a 2px lift. POS: an 18px corner and a wide, soft lift, with a 14px inner frame. In dark, both draw an edge line instead of a shadow, because a shadow on near-black reads as nothing; floating layers keep a deeper shadow with a faint light edge.
        </P>
        <ThemeQuad>
          <Sample />
        </ThemeQuad>
        <TokenTable rows={TOKENS} sample="shadow" label="Card tokens" />
        <Callout>
          Spacing: cards sit <Code>gap-section</Code> (16px) apart, a titled group sits <Code>gap-major</Code> (24px) from the next, and the page edge is <Code>px-gutter</Code>.
        </Callout>
      </DocSection>

      <DocSection id="record-cards" title="Record cards">
        <P>
          A record page (a ticket, an order, a customer) is a stack of titled cards. Three kit components draw them, so no page hand-builds a facts grid: <Code>DetailCard</Code> is the titled card, <Code>FactGrid</Code> is the label/value grid inside it, and <Code>TimelineCard</Code> is a card of dated events. The ticket stub the guest holds is the existing <Code>TicketCard</Code>, which the print pages draw too.
        </P>
        <Preview label="Facts: the few a reader opens the page for, then the rest">
          <RecordFacts />
        </Preview>
        <Callout title="Which one to use">
          <ul className="flex list-disc flex-col gap-tight pl-major">
            <li>
              <strong className="font-semibold">FactGrid</strong> for things that are true of the record: a name, a date, a status, a price. Label above, value below. The few facts a reader came for are <Code>tone=&quot;primary&quot;</Code>; the rest are <Code>secondary</Code>, in a second grid under a hairline.
            </li>
            <li>
              <strong className="font-semibold">ActivityList / TimelineCard</strong> for things that happened, in order: codes issued, scans at the gate, history. Use it when each row has a moment and a short outcome. Not for a long ledger of money (use a table).
            </li>
            <li>
              <strong className="font-semibold">TicketCard</strong> for the paper the guest is holding: a preview of what was printed or sent. It is mode-locked white and near-black, so it looks the same in light, dark and print.
            </li>
            <li>
              <strong className="font-semibold">Card</strong> alone for anything else: a form, a chart, a list of rows.
            </li>
          </ul>
        </Callout>
        <Small>
          A fact with no value reads &ldquo;Not recorded&rdquo; in muted text, so a row never looks like it failed to load. A value can be a link (an order, a customer), an identifier in DM Mono (a reference, a code) or a pill. Labels are sentence case, never uppercase.
        </Small>
      </DocSection>

      <DocSection id="timeline" title="Dated events">
        <P>
          Each row says what happened (a word, or a code in DM Mono), its status, and the moment at the end of the first line. A muted line under it says who or why, and a note carries the operator&rsquo;s own words. Colour only touches the word, and an icon and the word itself carry the meaning, never the colour alone. A replaced code is struck through and a pill says so.
        </P>
        <Preview label="Codes, check-in history, and an empty history">
          <RecordTimeline />
        </Preview>
      </DocSection>

      <DocSection id="ticket-stub" title="The ticket stub">
        <P>
          <Code>TicketCard</Code> is the paper ticket: the tier as a chip, the booking, the venue, the facts a guest checks, a dashed tear between two notches, and the stub with the QR beside its code. The record page shows exactly what the print page draws, built by the same function, so an operator reading a code over the phone reads what the guest holds. On a phone the record folds it behind a labelled heading (<Code>DetailCard fold bare</Code>).
        </P>
        <Preview label="TicketCard">
          <StubDemo />
        </Preview>
        <ThemeQuad label="A card of events in OS and POS, light and dark">
          <RecordSample />
        </ThemeQuad>
      </DocSection>

      <ComponentDoc
        id="detail-card"
        title="DetailCard"
        summary="A titled card for a record page. Header with title and optional actions, padded body."
        importCode={'import { DetailCard, FactGrid, TimelineCard, ActivityList } from "@/components/ui";'}
        props={[
          { prop: "title", type: "ReactNode", description: "The card title, text-md font-semibold." },
          { prop: "description", type: "ReactNode", description: "One sentence under the header." },
          { prop: "actions", type: "ReactNode", description: "Controls at the end of the header row." },
          { prop: "fold, summary", type: "boolean, ReactNode", description: "Below md the card is a closed disclosure with a one-line summary under its title." },
          { prop: "bare", type: "boolean", default: "false", description: "The content draws its own surface (the ticket stub): a plain heading above it on a computer." },
          { prop: "FactGrid facts", type: "Fact[]", description: "{ key, label, value, href?, mono?, span? }. An empty value reads Not recorded." },
          { prop: "FactGrid tone, columns", type: '"primary" | "secondary", 2 | 3 | 4', default: '"secondary", 4', description: "primary sets values at text-md font-semibold; secondary at text-base." },
          { prop: "TimelineCard items", type: "ActivityItem[]", description: "{ id, title, mono?, struck?, tone?, icon?, status?, time?, detail?, note? } plus an empty sentence." },
        ]}
        dos={["Lead with the few facts a reader came for, then the rest.", "Use mono only for identifiers.", "Say what is empty: Not recorded, Never scanned."]}
        donts={["Hand-build a label/value grid or a titled card.", "Colour a row to say what happened: the word and icon say it.", "Use uppercase tracked labels."]}
      />

      <ComponentDoc
        id="card"
        title="Card"
        importCode={'import { Card } from "@/components/ui";'}
        props={[
          { prop: "title, actions", type: "ReactNode", description: "An optional header row: a heading and controls at its end." },
          { prop: "headingLevel", type: "2 | 3 | 4", default: "2", description: "The heading level of title." },
          { prop: "padding", type: '"card" | "none"', default: '"card"', description: "none for a card holding a table or edge-to-edge rows; pair with table-inset." },
          { prop: "interactive", type: "boolean", default: "false", description: "Hover lift and press, for a card that is a link." },
          { prop: "glass", type: "boolean", default: "false", description: "Translucent and blurred, for floating panels." },
          { prop: "as", type: '"div" | "section" | "article" | "li" | "aside" | "form"', default: '"div"', description: "The element. A landmark-ish element is labelled by its title." },
        ]}
        dos={["Use Card, not a hand-typed card-surface string.", "Sink a group inside a card with a subtle fill and rounded-inner.", "Let the card colour against the page do the separating."]}
        donts={["Put a box with the same corner inside a card — step one size down.", "Draw a border around a card on a different surface.", "Add a shadow to a row: rows are flat, only the card carries elevation."]}
      />
    </>
  );
}

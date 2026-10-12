"use client";

import { Button, Card, Avatar, DataTable, type Column, EmptyState, MarketBadge, StatStrip, StatusPill, type PillTone } from "@/components/ui";
import { useState } from "react";
import { CalendarX, Plus, ReceiptText, Wallet } from "lucide-react";
import { Callout, Code, ComponentDoc, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";

interface Order {
  id: string;
  ref: string;
  who: string;
  total: number;
  status: string;
}
const ORDERS: Order[] = [
  { id: "1", ref: "CF-2026-001053", who: "Ayesha Siddika", total: 172500, status: "paid" },
  { id: "2", ref: "CF-2026-001052", who: "Rahim Khan", total: 80000, status: "partial" },
  { id: "3", ref: "CF-2026-001051", who: "Tanvir Ahmed", total: 307500, status: "refunded" },
  { id: "4", ref: "CF-2026-001050", who: "Mohammad Abdur Rahman Chowdhury", total: 1117800, status: "pending" },
];
const money = (minor: number) => `৳${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const COLUMNS: Column<Order>[] = [
  { key: "ref", header: "Reference", mono: true, render: (r) => r.ref },
  { key: "who", header: "Customer", render: (r) => r.who },
  { key: "total", header: "Total", align: "right", render: (r) => money(r.total) },
  { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
];

function TableDemo() {
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "ref", order: "desc" });
  const rows = [...ORDERS].sort((a, b) => {
    const k = sort.key as keyof Order;
    const c = String(a[k]).localeCompare(String(b[k]), undefined, { numeric: true });
    return sort.order === "asc" ? c : -c;
  });
  return (
    <DataTable
      columns={COLUMNS.map((c) => ({ ...c, sortable: c.key !== "status" }))}
      rows={rows}
      getRowId={(r) => r.id}
      sort={sort}
      onSortChange={(key) => setSort((s) => ({ key, order: s.key === key && s.order === "desc" ? "asc" : "desc" }))}
      onRowClick={() => {}}
      height="page"
    />
  );
}

const TONES: PillTone[] = ["success", "warning", "danger", "info", "neutral"];
const STATUSES = ["paid", "partial", "pending", "refunded", "cancelled", "active", "inactive", "archived"];

function Pills() {
  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-wrap gap-tight">
        {TONES.map((t) => (
          <StatusPill key={t} tone={t}>
            {t}
          </StatusPill>
        ))}
      </div>
      <div className="flex flex-wrap gap-tight">
        {STATUSES.map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </div>
    </div>
  );
}

function Stats() {
  return (
    <div className="flex flex-col gap-major">
      <StatStrip
        variant="tiles"
        items={[
          { key: "rev", icon: <Wallet size={16} strokeWidth={1.5} aria-hidden />, label: "Revenue", value: "৳41,653", context: "vs ৳38,818 last week" },
          { key: "orders", icon: <ReceiptText size={16} strokeWidth={1.5} aria-hidden />, label: "Orders", value: "156", context: "12 today" },
        ]}
      />
      <StatStrip
        items={[
          { key: "a", label: "Collected", value: "৳502,445" },
          { key: "b", label: "Orders", value: "156" },
          { key: "c", label: "Outstanding", value: "৳33,465", tone: "warning" },
        ]}
      />
    </div>
  );
}

function Cards() {
  return (
    <div className="grid gap-section md:grid-cols-2">
      <Card title="Payment methods" actions={<Button size="sm" variant="secondary">Edit</Button>}>
        <p className="text-sm text-muted">A card with a titled header row and its controls at the end.</p>
      </Card>
      <Card interactive>
        <p className="text-md font-semibold">Interactive card</p>
        <p className="text-sm text-muted">Lifts on hover and presses in — for a card that is a link.</p>
      </Card>
    </div>
  );
}

function Misc() {
  return (
    <div className="grid gap-section md:grid-cols-2">
      <div className="card-surface">
        <EmptyState icon={<CalendarX size={20} strokeWidth={1.5} aria-hidden />} title="No bookings yet" message="Bookings you put on sale show up here." action={<Button size="sm" icon={<Plus size={16} strokeWidth={1.5} aria-hidden />}>New booking</Button>} />
      </div>
      <div className="card-surface flex flex-col gap-section p-card">
        <div className="flex items-center gap-tight">
          <Avatar name="Nadia Islam" />
          <Avatar name="Rahim Khan" soft />
          <Avatar name="Karim Hossain" size={32} />
          <span className="text-sm text-muted">Avatar · solid, soft, 32</span>
        </div>
        <div className="flex flex-wrap items-center gap-tight">
          {(["viator", "klook", "getyourguide"] as const).map((m) => (
            <span key={m} className="inline-flex items-center gap-inline text-sm">
              <MarketBadge id={m} />
              <span className="text-muted">{m}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted">MarketBadge: initials in an info-blue rounded rectangle (market-solid, with on-solid text). The marketplace&rsquo;s name is always in the accessible name beside it.</p>
      </div>
    </div>
  );
}

export function DataDisplaySection() {
  return (
    <>
      <SectionHeader slug="data-display" />

      <ComponentDoc
        id="data-table"
        title="DataTable"
        summary="13px headers, 14px cells, 48px rows, hairline dividers, a sticky header, aria-sort and focusable rows. Below md it becomes a list: two lines a row, or a purpose-built card."
        demo={
          <Preview flush label="Sortable, with a long name that wraps">
            <TableDemo />
          </Preview>
        }
        importCode={'import { DataTable, type Column } from "@/components/ui";'}
        props={[
          { prop: "columns", type: "Column<T>[]", description: "{ key, header, render?, sortable?, align?, mono?, width?, phone? }. mono is for identifiers only." },
          { prop: "rows, getRowId", type: "T[], (row) => string", description: "The data and a stable id." },
          { prop: "sort, onSortChange", type: "{ key, order }, (key) => void", description: "Controlled sorting; sets aria-sort." },
          { prop: "onRowClick", type: "(row) => void", description: "A whole-row link; rows become tab stops with Enter/Space." },
          { prop: "pagination", type: "{ page, pageSize, total, onPageChange }", description: "The shared pager under the table." },
          { prop: "renderCard / cardVariant", type: "(row) => node / “cards” | “list”", description: "How a row reads below md." },
          { prop: "loading, skeletonRows, emptyState", type: "boolean, number, node", description: "Skeleton rows shaped like the columns; an empty state." },
          { prop: "toolbar, toolbarInCard, height, minWidth, layout", type: "—", description: "Search and filters above; page height or a 70vh box; sideways scroll; fixed columns." },
        ]}
        dos={["Right-align figures and use tabular numerals.", "Let a distinguishing name wrap; truncate only where the full value is reachable.", "Show a skeleton the shape of the data while loading."]}
        donts={["Set money in DM Mono — mono: true is for identifiers.", "Put a table in a card that already has a frame.", "Build a phone view from the desktop table; give it a renderCard."]}
      />

      <ComponentDoc
        id="status-pill"
        title="StatusPill"
        summary="Sentence case on a soft tint, no dot, no border; the word carries the meaning. Tone says what happened to the money; a record state (active, archived) is a quieter neutral tint."
        demo={
          <Preview label="Tones, then domain statuses">
            <Pills />
          </Preview>
        }
        importCode={'import { StatusPill } from "@/components/ui";'}
        props={[
          { prop: "status", type: "string", description: "A domain status: tone and label are derived (translated)." },
          { prop: "tone", type: '"success" | "warning" | "danger" | "info" | "neutral"', description: "Set directly with children when there is no domain status." },
          { prop: "shape", type: '"transaction" | "record"', description: "Override the lifecycle the status belongs to." },
        ]}
        dos={["Use status= so the tone and the translated word stay in step.", "Treat warning as “someone has to act”: a part-paid order."]}
        donts={["Rely on colour — the word is always there.", "Reuse one tone for two meanings (pending and part paid are different).", "Put a dot or border on it."]}
      />

      <ComponentDoc
        id="stat-strip"
        title="StatStrip"
        summary="The figures at the top of a page. Only the dashboard, Finances and Analytics draw them; both layouts live in one component so a page cannot invent a third."
        demo={
          <Preview label="Tiles (dashboard) and band">
            <Stats />
          </Preview>
        }
        importCode={'import { StatStrip } from "@/components/ui";'}
        props={[
          { prop: "items", type: "StatItem[]", description: "{ key, label, value, icon?, context?, delta?, tone?, note?, onClick?, pressed? }." },
          { prop: "variant", type: '"band" | "tiles"', default: '"band"', description: "tiles is the dashboard's card per metric." },
          { prop: "columns, wideColumns", type: "number", description: "Band only: how many figures sit across." },
          { prop: "loading", type: "boolean", description: "Skeleton figures." },
        ]}
        dos={["Order items by importance — on a phone the first one leads.", "Keep figures whole: a clipped figure is a different number."]}
        donts={["Add stat cards to a list page.", "Shrink the type to fit four figures across a phone."]}
      />

      <ComponentDoc
        id="card"
        title="Card"
        summary="The one surface: card-surface is rounded-card with the product's resting elevation. Padding is p-card."
        demo={
          <Preview label="Titled and interactive">
            <Cards />
          </Preview>
        }
        importCode={'import { Card } from "@/components/ui";'}
        props={[
          { prop: "title, actions", type: "ReactNode", description: "An optional header row with a heading and controls." },
          { prop: "padding", type: '"card" | "none"', default: '"card"', description: "none for a card holding a table or edge-to-edge rows." },
          { prop: "interactive", type: "boolean", description: "Hover lift and press, for clickable cards." },
          { prop: "glass", type: "boolean", description: "Translucent, for floating panels." },
          { prop: "as, headingLevel", type: "element, 2 | 3 | 4", description: "The element, and the heading level of title." },
        ]}
        dos={["Use Card instead of hand-rolling card-surface strings.", "Space cards gap-section apart."]}
        donts={["Nest a bordered card in a card — use a subtle fill.", "Pass a title attribute; use the title prop."]}
      />

      <DocSection id="empty-avatar-market" title="EmptyState, Avatar and MarketBadge">
        <P>
          <Code>EmptyState</Code> is a quiet centred stack — a soft disc with the glyph, a title, one line of reason and the way out — with no frame of its own, because the card it sits in is the frame. <Code>Avatar</Code> is an initials disc for staff, guides and providers. <Code>MarketBadge</Code> says “sold through a marketplace” in letters and a shape, so colour is never the only carrier.
        </P>
        <Preview label="EmptyState · Avatar · MarketBadge">
          <Misc />
        </Preview>
        <Callout>
          Imports: <Code>{'import { EmptyState, MarketBadge, Avatar } from "@/components/ui";'}</Code>. EmptyState takes <Code>icon</Code>, <Code>title</Code>, <Code>message</Code> and <Code>action</Code>; Avatar takes <Code>name</Code>, <Code>size</Code> and <Code>soft</Code>; MarketBadge takes <Code>id</Code> (a marketplace) and <Code>size</Code> (<Code>os</Code> or <Code>go</Code>).
        </Callout>
      </DocSection>
    </>
  );
}

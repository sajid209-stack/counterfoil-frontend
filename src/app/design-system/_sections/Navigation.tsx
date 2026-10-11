"use client";

import { ActionMenu, Pagination, Tabs, tabPanelProps } from "@/components/ui";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, LayoutDashboard, ReceiptText, Settings, Store, Ticket, UsersRound, Eye, Pencil, Archive } from "lucide-react";
import { cn } from "@/lib/cn";
import { Callout, Code, ComponentDoc, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";

function TabsDemo() {
  const [v, setV] = useState("all");
  const [p, setP] = useState("day");
  const items = [
    { value: "all", label: "All", count: 156 },
    { value: "paid", label: "Paid", count: 112 },
    { value: "part", label: "Part paid", count: 9 },
    { value: "refunded", label: "Refunded", count: 4 },
    { value: "void", label: "Void", disabled: true },
  ];
  return (
    <div className="flex flex-col gap-section">
      <div className="card-surface p-card">
        <Tabs id="ds-tabs" aria-label="Order status" value={v} onChange={setV} items={items} />
        <div {...tabPanelProps("ds-tabs", v)} className="mt-comfortable text-sm text-muted">
          Panel for <span className="font-medium text-fg">{v}</span>. The caller renders it and spreads <span className="font-mono">tabPanelProps</span> so the tab and its panel name each other.
        </div>
      </div>
      <div className="card-surface p-card">
        <Tabs variant="pill" aria-label="Calendar range" value={p} onChange={setP} items={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
      </div>
    </div>
  );
}

function MenuDemo() {
  const [last, setLast] = useState("Nothing chosen yet");
  return (
    <div className="card-surface flex min-h-60 items-start justify-between gap-tight p-card">
      <div>
        <p className="text-md font-semibold">Winter Exhibition Pass</p>
        <p className="text-sm text-muted">{last}</p>
      </div>
      <ActionMenu
        label="More actions for Winter Exhibition Pass"
        items={[
          { key: "view", label: "View", icon: <Eye size={16} strokeWidth={1.5} aria-hidden />, onSelect: () => setLast("View chosen") },
          { key: "edit", label: "Edit", icon: <Pencil size={16} strokeWidth={1.5} aria-hidden />, onSelect: () => setLast("Edit chosen") },
          { key: "archive", label: "Archive", icon: <Archive size={16} strokeWidth={1.5} aria-hidden />, destructive: true, separated: true, onSelect: () => setLast("Archive chosen") },
          { key: "locked", label: "Delete", disabled: true, hint: "Bookings that have sold can only be archived.", onSelect: () => {} },
        ]}
      />
    </div>
  );
}

function PagerDemo() {
  const [page, setPage] = useState(2);
  const [size, setSize] = useState(20);
  return (
    <div className="card-surface p-card">
      <Pagination page={page} pageSize={size} total={156} onPageChange={setPage} pageSizeOptions={[10, 20, 50]} onPageSizeChange={(n) => { setSize(n); setPage(1); }} />
    </div>
  );
}

/* The OS rail, redrawn from the same classes the real Sidebar uses, so the
   pattern can be shown inside a preview without a router. */
const RAIL = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Calendar", Icon: CalendarDays },
  { label: "Orders", Icon: ReceiptText },
  { label: "Customers", Icon: UsersRound },
  { label: "Catalog", Icon: Ticket },
];
function Rail() {
  const [current, setCurrent] = useState("Orders");
  const row = (label: string, Icon: typeof Ticket, leaves = false) => (
    <li key={label}>
      <button
        type="button"
        onClick={() => setCurrent(label)}
        aria-current={current === label ? "page" : undefined}
        className={cn(
          "flex h-9 w-full items-center gap-comfortable rounded-sm px-comfortable text-base font-medium transition-colors duration-quick",
          current === label ? "bg-fg/[0.07] text-fg dark:bg-fg/[0.09]" : "text-muted hover:bg-fg/[0.04] hover:text-fg",
        )}
      >
        <Icon size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {leaves && <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
      </button>
    </li>
  );
  return (
    <nav aria-label="Example rail" className="w-60 max-w-full rounded-md bg-chrome p-tight">
      <ul className="flex flex-col gap-inline">{RAIL.map((r) => row(r.label, r.Icon))}</ul>
      <div aria-hidden className="mx-comfortable my-tight h-px bg-hairline" />
      <ul className="flex flex-col gap-inline">{row("Point of Sale", Store, true)}</ul>
      <div aria-hidden className="mx-comfortable my-tight h-px bg-hairline" />
      <ul className="flex flex-col gap-inline">{row("Settings", Settings)}</ul>
    </nav>
  );
}

export function NavigationSection() {
  return (
    <>
      <SectionHeader slug="navigation" />

      <ComponentDoc
        id="tabs"
        title="Tabs"
        summary="Navigation between related content on one page. Underline (the default) or pill: the current tab is told by weight and a 2px bar, or by a fill, and the others are plain muted words. A strip never wraps — on a narrow screen it scrolls."
        demo={
          <Preview label="Underline with counts and a panel · pill">
            <TabsDemo />
          </Preview>
        }
        importCode={'import { Tabs } from "@/components/ui";'}
        props={[
          { prop: "items", type: "{ value, label, count?, disabled? }[]", description: "The tabs, in order." },
          { prop: "value / onChange", type: "string / (value) => void", description: "Controlled. The caller renders the active panel. Arrow keys move between tabs." },
          { prop: "variant", type: '"underline" | "pill"', default: '"underline"', description: "A quiet rule with a 2px bar, or a row of soft pills for a strip on its own." },
          { prop: "id + tabPanelProps(id, value)", type: "string", description: "Give Tabs an id and spread tabPanelProps on the panel so tab and panel name each other." },
          { prop: "panelId", type: "string | (value) => string", description: "Override where aria-controls points: one shared panel, or one per tab." },
          { prop: "aria-label", type: "string", description: "Names the tab list." },
          { prop: "className", type: "string", description: "On the strip." },
        ]}
        dos={["Use for views of the same thing: All / Paid / Part paid.", "Show a count where it helps a decision."]}
        donts={["Use for one-of-two modes — that is a SegmentedControl.", "Put more than five or six in a strip."]}
      />

      <ComponentDoc
        id="action-menu"
        title="ActionMenu"
        summary="An overflow menu for actions that should not all be buttons. It stops its own clicks, so it is safe inside a row that navigates, and a disabled item can say why."
        demo={
          <Preview label="A row menu with a destructive item and a disabled one">
            <MenuDemo />
          </Preview>
        }
        importCode={'import { ActionMenu } from "@/components/ui";'}
        props={[
          { prop: "label", type: "string", description: "The trigger's accessible name — say what it acts on." },
          { prop: "items", type: "ActionMenuItem[]", description: "{ key, label, onSelect, icon?, destructive?, disabled?, hint?, separated? }." },
          { prop: "shape", type: '"default" | "go"', default: '"default"', description: "go is round and 44px at every width." },
          { prop: "keyboard", type: "—", description: "Enter, Space or ArrowDown opens on the first item (ArrowUp on the last); arrows move and skip disabled items, Home/End jump, Tab closes, Escape closes and returns focus." },
        ]}
        dos={["Keep the primary action visible and the rest in the menu.", "Put destructive items last, separated, and confirm them.", "Explain a disabled item in its hint."]}
        donts={["Put a menu of fewer than three things behind a menu button.", "Leave a disabled item unexplained."]}
      />

      <ComponentDoc
        id="pagination"
        title="Pagination"
        summary="The one pager: the range on screen on the left; an optional page-size choice, previous, “Page 2 of 8” and next on the right."
        demo={
          <Preview label="With a page-size choice">
            <PagerDemo />
          </Preview>
        }
        importCode={'import { Pagination } from "@/components/ui";'}
        props={[
          { prop: "page, pageSize, total", type: "number", description: "One-based page." },
          { prop: "onPageChange", type: "(page) => void", description: "Called with the new page." },
          { prop: "pageSizeOptions, onPageSizeChange", type: "number[], (n) => void", description: "Pass both to offer a page-size choice." },
          { prop: "loading", type: "boolean", default: "false", description: "Disables the buttons." },
        ]}
        dos={["Reset to page 1 when the page size or a filter changes.", "Keep the range text — it says how much there is."]}
        donts={["Page a list of twenty rows.", "Hide the total."]}
      />

      <DocSection id="rail" title="The OS rail">
        <P>
          One list of destinations feeds the rail, the collapsed rail&rsquo;s tooltips, the phone&rsquo;s menu sheet and the command palette, so they cannot drift. Rows are 36px (44 on touch); the current page is a soft ink tint, with no border or shadow; the apps you leave OS for carry a <Code>↗</Code> and are set apart by a hairline; Settings sits at the foot.
        </P>
        <Preview label="The rail pattern">
          <Rail />
        </Preview>
        <Callout>
          On a phone the rail becomes a floating menu button that opens the same list as a sheet. Press the rows above to see the current-page tint move.
        </Callout>
      </DocSection>
    </>
  );
}

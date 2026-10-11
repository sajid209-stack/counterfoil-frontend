"use client";

import { ActionMenu, Button, FilterBar, FilterSearch, type FilterSpec, Select, StatusPill, Switch } from "@/components/ui";
import { useState } from "react";
import { ArrowLeft, Download, Plus } from "lucide-react";
import { Callout, Code, DoDont, DocSection, P, SectionHeader } from "../_components/Doc";
import { Preview } from "../_components/Preview";

const STATUS = [
  { value: "", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Part paid" },
];
const CHANNEL = [
  { value: "", label: "All channels" },
  { value: "counter", label: "Counter" },
  { value: "online", label: "Online" },
];

function ShellMock() {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-chrome">
      <div className="flex">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-tight py-comfortable sm:flex" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-6 w-6 rounded-sm ${i === 1 ? "bg-fg/[0.12]" : "bg-fg/[0.06]"}`} />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex h-12 items-center justify-between gap-tight px-section">
            <span className="text-md font-semibold">Orders</span>
            <span className="text-sm text-muted">Lalbagh Fort ▾</span>
          </div>
          <div className="mr-tight mb-tight rounded-lg bg-surface p-section">
            <div className="flex items-center justify-between gap-tight">
              <p className="text-xl font-semibold tracking-title">Orders</p>
              <Button size="sm" icon={<Plus size={16} strokeWidth={1.5} aria-hidden />}>
                New order
              </Button>
            </div>
            <div className="card-surface mt-section p-card text-sm text-muted">One card, one purpose. Cards sit gap-section apart inside the frame.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarDemo() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const filters: FilterSpec[] = [
    {
      key: "status",
      label: "Status",
      control: <Select aria-label="Status" value={status} onChange={setStatus} options={STATUS} />,
      active: status ? STATUS.find((s) => s.value === status)?.label : null,
      onClear: () => setStatus(""),
    },
    {
      key: "channel",
      label: "Channel",
      control: <Select aria-label="Channel" value={channel} onChange={setChannel} options={CHANNEL} />,
      active: channel ? CHANNEL.find((s) => s.value === channel)?.label : null,
      onClear: () => setChannel(""),
    },
  ];
  return (
    <div className="card-surface p-card">
      <FilterBar
        search={<FilterSearch value={q} onChange={setQ} placeholder="Search orders" />}
        filters={filters}
        actions={
          <Button variant="secondary" size="sm" icon={<Download size={16} strokeWidth={1.5} aria-hidden />}>
            Export
          </Button>
        }
      />
    </div>
  );
}

const ROWS = [
  { ref: "CF-2026-001053", who: "Ayesha Siddika", total: "৳1,725.00", status: "paid" },
  { ref: "CF-2026-001052", who: "Rahim Khan", total: "৳800.00", status: "partial" },
  { ref: "CF-2026-001051", who: "Tanvir Ahmed", total: "৳3,075.00", status: "refunded" },
];

function ListToRecord() {
  const [open, setOpen] = useState<string | null>(null);
  const row = ROWS.find((r) => r.ref === open);
  if (row) {
    return (
      <div className="flex flex-col gap-section">
        <div className="flex flex-wrap items-center gap-tight">
          <Button variant="tertiary" size="sm" icon={<ArrowLeft size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setOpen(null)}>
            Orders
          </Button>
          <StatusPill status={row.status} />
          <span className="flex-1" />
          <Button size="sm">Take payment</Button>
          <ActionMenu label="More actions" items={[{ key: "print", label: "Print receipt", onSelect: () => {} }, { key: "refund", label: "Refund…", destructive: true, separated: true, onSelect: () => {} }]} />
        </div>
        <div className="card-surface p-card">
          <p className="font-mono text-sm text-muted">{row.ref}</p>
          <p className="text-3xl font-semibold tracking-figure">{row.total}</p>
          <p className="text-sm text-muted">{row.who}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card-surface overflow-hidden">
      <ul>
        {ROWS.map((r) => (
          <li key={r.ref} className="border-b border-hairline last:border-0">
            <button type="button" onClick={() => setOpen(r.ref)} className="flex min-h-12 w-full items-center justify-between gap-tight px-card py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash">
              <span className="min-w-0">
                <span className="block font-mono text-sm">{r.ref}</span>
                <span className="block truncate text-sm text-muted">{r.who}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-inline">
                <span className="text-base font-medium tabular-nums">{r.total}</span>
                <StatusPill status={r.status} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsRows() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [saved, setSaved] = useState({ a: true, b: false });
  const dirty = a !== saved.a || b !== saved.b;
  return (
    <div className="flex flex-col gap-section">
      <section className="card-surface overflow-hidden">
        <h3 className="px-card pt-card text-md font-semibold">Customer messages</h3>
        <ul className="mt-tight">
          {[
            { label: "Booking confirmed", desc: "Sent when a sale completes.", v: a, set: setA },
            { label: "Reminder", desc: "Sent the day before.", v: b, set: setB },
          ].map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-section border-t border-hairline px-card py-comfortable">
              <div className="min-w-0">
                <p className="text-base">{r.label}</p>
                <p className="text-sm text-muted">{r.desc}</p>
              </div>
              <Switch aria-label={r.label} checked={r.v} onChange={r.set} />
            </li>
          ))}
        </ul>
      </section>
      {dirty && (
        <div role="status" className="card-surface flex items-center justify-between gap-section p-comfortable">
          <p className="text-sm text-muted">You have unsaved changes.</p>
          <div className="flex gap-tight">
            <Button variant="secondary" size="sm" onClick={() => { setA(saved.a); setB(saved.b); }}>
              Discard
            </Button>
            <Button size="sm" onClick={() => setSaved({ a, b })}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OsPatternsSection() {
  return (
    <>
      <SectionHeader slug="os-patterns" />

      <DocSection id="shell" title="Page shell">
        <P>
          OS is admin and monitoring. The rail and top bar are white chrome; the page sits in a rounded frame on the paper colour and scrolls inside it. The bar names the page and carries the venue and the account — <em>not</em> the page&rsquo;s own buttons, which sit in the page&rsquo;s toolbar. A page has a title on the left and <strong className="font-semibold">one primary action</strong> on the right.
        </P>
        <Preview product="os" label="The frame">
          <ShellMock />
        </Preview>
      </DocSection>

      <DocSection id="toolbar" title="Toolbar and filter bar">
        <P>
          One line: search, at most one key filter inline, a <strong className="font-semibold">Filters</strong> button that counts what is set, and at most two actions. Everything else folds behind Filters — a popover on a desktop, a sheet on a phone — and whatever is set comes back out as a removable chip, so nothing chosen is ever only inside a closed panel.
        </P>
        <Preview product="os" label="Pick a status, then look at the chips">
          <ToolbarDemo />
        </Preview>
        <DoDont
          dos={["Keep search visible; fold the rest.", "Name a chip by its value: “Status: Paid”.", "Put Clear filters at the end of the chips."]}
          donts={["Draw four selects across the top of a phone.", "Add a stat band to a list page.", "Put the page's buttons in the top bar."]}
        />
      </DocSection>

      <DocSection id="list-record" title="List to record">
        <P>
          A list is one card of hairline-divided rows; the whole row is the link. The record leads with the facts that matter — state, amount, who — then the primary action, with the rest under <Code>⋯</Code>. A way back sits on the record&rsquo;s own row. Press a row.
        </P>
        <Preview product="os" label="Press an order">
          <ListToRecord />
        </Preview>
      </DocSection>

      <DocSection id="settings" title="Settings rows">
        <P>
          Label and what it does on the left, the control on the right, rows divided by hairlines inside a titled card. A switch in a list takes effect as it flips (with Undo) or is saved with the page; a save bar exists <em>only while something has changed</em>.
        </P>
        <Preview product="os" label="Flip a switch">
          <SettingsRows />
        </Preview>
        <Callout>Every record page has one primary action; secondary ones live under “⋯”. A destructive one is last, separated, and confirmed.</Callout>
      </DocSection>
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus, Search, Trash2, Inbox } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageShell,
  StatusPill,
  Tabs,
  useToast,
  type Column,
} from "@/components/ui";

type DemoRow = { id: string; name: string; code: string; status: string };
const DEMO_ROWS: DemoRow[] = [
  { id: "1", name: "Fort General Admission", code: "CF-2026-000101", status: "active" },
  { id: "2", name: "Museum Timed Entry", code: "CF-2026-000102", status: "pending" },
  { id: "3", name: "Heritage Walking Tour", code: "CF-2026-000103", status: "active" },
  { id: "4", name: "2025 Winter Gala", code: "CF-2026-000104", status: "archived" },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-major">
      <h2 className="type-label mb-section text-[13px] text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function KitchenSink() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [tab, setTab] = useState("all");
  const [tableLoading, setTableLoading] = useState(false);
  const [tableEmpty, setTableEmpty] = useState(false);
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "name",
    order: "asc",
  });
  const [page, setPage] = useState(1);
  const [toggle, setToggle] = useState(true);

  const columns: Column<DemoRow>[] = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "code",
      header: "Reference",
      render: (r) => <span className="font-mono text-[13px]">{r.code}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} />,
    },
  ];

  const onConfirm = () => {
    setConfirmLoading(true);
    setTimeout(() => {
      setConfirmLoading(false);
      setConfirmOpen(false);
      toast.success("Archived.");
    }, 900);
  };

  return (
    <main className="mx-auto max-w-4xl px-section py-hero">
      <p className="type-label text-[13px] text-ember">Primitives</p>
      <h1 className="type-display mt-tight text-4xl">Kitchen sink</h1>
      <p className="type-body mt-section max-w-xl text-muted">
        Every primitive in every state. These are the reusable pieces the ~15
        CRUD screens assemble from — no product logic inside any of them.
      </p>

      <Block title="Button — variants">
        <div className="flex flex-wrap items-center gap-tight">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </Block>

      <Block title="Button — states, sizes, icons">
        <div className="flex flex-wrap items-center gap-tight">
          <Button icon={<Plus size={16} strokeWidth={1.5} />}>With icon</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large (Go)</Button>
        </div>
      </Block>

      <Block title="StatusPill">
        <div className="flex flex-wrap items-center gap-tight">
          <StatusPill status="confirmed">Confirmed</StatusPill>
          <StatusPill status="pending">Pending</StatusPill>
          <StatusPill status="refunded">Refunded</StatusPill>
          <StatusPill status="active" />
          <StatusPill status="inactive" />
          <StatusPill status="archived" />
        </div>
      </Block>

      <Block title="FormField — variants, error, disabled">
        <div className="grid max-w-xl gap-section sm:grid-cols-2">
          <FormField label="Text" placeholder="Adult" help="Help text goes here." />
          <FormField label="Number" variant="number" placeholder="0" />
          <FormField
            label="Select"
            variant="select"
            options={[
              { value: "a", label: "Admission" },
              { value: "t", label: "Tours" },
            ]}
          />
          <FormField label="Date" variant="date" />
          <FormField
            label="With error"
            placeholder="Adult"
            error="Name is required."
          />
          <FormField label="Disabled" placeholder="Locked" disabled />
          <FormField
            label="Textarea"
            variant="textarea"
            placeholder="Description…"
            className="sm:col-span-2"
          />
          <FormField
            label="Notifications enabled"
            variant="toggle"
            checked={toggle}
            onChange={(e) => setToggle((e.target as HTMLInputElement).checked)}
          />
        </div>
      </Block>

      <Block title="Tabs">
        <Tabs
          items={[
            { value: "all", label: "All", count: 4 },
            { value: "active", label: "Active", count: 2 },
            { value: "archived", label: "Archived", count: 1 },
          ]}
          value={tab}
          onChange={setTab}
        />
        <p className="mt-section font-mono text-[12px] text-faint">
          active tab: {tab}
        </p>
      </Block>

      <Block title="Modal + Toast">
        <div className="flex flex-wrap gap-tight">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button
            variant="destructive"
            icon={<Trash2 size={16} strokeWidth={1.5} />}
            onClick={() => setConfirmOpen(true)}
          >
            Destructive confirm
          </Button>
          <Button variant="tertiary" onClick={() => toast.success("Saved.")}>
            Toast success
          </Button>
          <Button variant="tertiary" onClick={() => toast.error("Something failed.")}>
            Toast error
          </Button>
          <Button variant="tertiary" onClick={() => toast.info("Heads up.")}>
            Toast info
          </Button>
        </div>
      </Block>

      <Block title="EmptyState">
        <EmptyState
          icon={<Inbox size={28} strokeWidth={1.5} />}
          title="No bookings yet"
          message="Create your first booking to start selling at the counter or online."
          action={<Button icon={<Plus size={16} strokeWidth={1.5} />}>New booking</Button>}
        />
      </Block>

      <Block title="DataTable — loading, empty, sort, pagination">
        <div className="mb-section flex flex-wrap gap-tight">
          <Button size="sm" variant="secondary" onClick={() => setTableLoading((v) => !v)}>
            Toggle loading
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setTableEmpty((v) => !v)}>
            Toggle empty
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={tableEmpty ? [] : DEMO_ROWS}
          getRowId={(r) => r.id}
          loading={tableLoading}
          sort={sort}
          onSortChange={(key) =>
            setSort((s) => ({
              key,
              order: s.key === key && s.order === "asc" ? "desc" : "asc",
            }))
          }
          onRowClick={(r) => toast.info(`Clicked ${r.name}`)}
          toolbar={
            <div className="flex items-center gap-tight">
              <div className="relative">
                <Search
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint"
                />
                <input
                  placeholder="Search…"
                  className="h-9 rounded-sm border border-line pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
                />
              </div>
            </div>
          }
          emptyState={
            <EmptyState title="No results" message="Try a different search or filter." />
          }
          pagination={{ page, pageSize: 20, total: tableEmpty ? 0 : 4, onPageChange: setPage }}
        />
      </Block>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Edit booking"
        description="A standard modal with a header, body, and footer actions."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast.success("Saved.");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <FormField label="Name" defaultValue="Fort General Admission" />
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onConfirm}
        title="Archive this booking?"
        message="It will be hidden from sale. You can restore it later."
        confirmLabel="Archive"
        loading={confirmLoading}
      />
    </main>
  );
}

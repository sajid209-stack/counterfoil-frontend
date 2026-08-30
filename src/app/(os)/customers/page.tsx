"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Download, Mail, Merge, Plus, Search, Smartphone } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageShell,
  StatusPill,
  useToast,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  createCustomer,
  findDuplicateCustomers,
  hasConsent,
  listCustomerRows,
  mergeCustomers,
  type CustomerWithStats,
  type DuplicateMatch,
} from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

type Segment = "all" | "flagged" | "email" | "sms";

export default function CustomersPage() {
  const router = useRouter();
  const t = useTranslations("customers");
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);

  const filters = useMemo(() => {
    if (segment === "flagged") return { flagged: true };
    if (segment === "email") return { consent: "email" };
    if (segment === "sms") return { consent: "sms" };
    return {};
  }, [segment]);

  const rowsQ = useApiQuery(
    () => listCustomerRows({ pageSize: 500, search, filters }),
    [search, segment],
  );
  const rows = useMemo(() => rowsQ.data?.data ?? [], [rowsQ.data]);

  // §63.10 — a group built from the filters above, exported as it stands.
  const exportGroup = useCallback(() => {
    const header = "Name,Phone,Email,Bookings,Spent,Visits,No-shows,Last seen,Email consent,SMS consent,Tags";
    const body = rows.map((c) =>
      [
        `"${c.name}"`,
        `"${c.phone ?? ""}"`,
        `"${c.email ?? ""}"`,
        c.stats.orders,
        (c.stats.spent / 100).toFixed(2),
        c.stats.visits,
        c.stats.noShows,
        c.stats.lastSeen?.slice(0, 10) ?? "",
        hasConsent(c, "email") ? "yes" : "no",
        hasConsent(c, "sms") ? "yes" : "no",
        `"${c.tags.join(" ")}"`,
      ].join(","),
    );
    const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${segment}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("exported", { count: rows.length }));
  }, [rows, segment, t, toast]);

  const columns: Column<CustomerWithStats>[] = [
    {
      key: "name",
      header: t("colCustomer"),
      sortable: false,
      render: (c) => (
        <div className="flex min-w-0 items-center gap-tight">
          <span className="min-w-0 break-words font-medium">{c.name}</span>
          {c.flag && (
            <AlertTriangle
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-warning"
              aria-label={t("flaggedLabel")}
            />
          )}
          {c.tags.map((tag) => (
            <StatusPill key={tag} tone="neutral">
              {tag}
            </StatusPill>
          ))}
        </div>
      ),
    },
    {
      key: "contact",
      header: t("colContact"),
      render: (c) => (
        <div className="min-w-0 text-[12px] text-muted">
          {c.phone && <div className="font-mono whitespace-nowrap">{c.phone}</div>}
          {c.email && <div className="truncate">{c.email}</div>}
          {!c.phone && !c.email && <span className="text-faint">{t("noContact")}</span>}
        </div>
      ),
    },
    {
      key: "consent",
      header: t("colConsent"),
      render: (c) => (
        <div className="flex items-center gap-inline">
          <Mail
            size={14}
            strokeWidth={1.5}
            className={hasConsent(c, "email") ? "text-success" : "text-faint"}
            aria-label={hasConsent(c, "email") ? t("consentEmailYes") : t("consentEmailNo")}
          />
          <Smartphone
            size={14}
            strokeWidth={1.5}
            className={hasConsent(c, "sms") ? "text-success" : "text-faint"}
            aria-label={hasConsent(c, "sms") ? t("consentSmsYes") : t("consentSmsNo")}
          />
        </div>
      ),
    },
    {
      key: "orders",
      header: t("colBookings"),
      align: "right",
      render: (c) => <span className="font-mono">{c.stats.orders}</span>,
    },
    {
      key: "spent",
      header: t("colSpent"),
      align: "right",
      render: (c) => (
        <span className="font-mono whitespace-nowrap">{formatMoney(c.stats.spent)}</span>
      ),
    },
    {
      key: "lastSeen",
      header: t("colLastVisit"),
      align: "right",
      render: (c) => (
        <span className="font-mono whitespace-nowrap text-[12px] text-muted">
          {c.stats.lastSeen ? formatDate(c.stats.lastSeen) : "—"}
        </span>
      ),
    },
  ];

  const segments: { value: Segment; label: string }[] = [
    { value: "all", label: t("segAll") },
    { value: "flagged", label: t("segFlagged") },
    { value: "email", label: t("segEmail") },
    { value: "sms", label: t("segSms") },
  ];

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <div className="flex flex-wrap items-center gap-tight">
          <Button
            variant="secondary"
            icon={<Merge size={16} strokeWidth={1.5} />}
            onClick={() => setDupOpen(true)}
          >
            {t("findDuplicates")}
          </Button>
          <Button
            variant="secondary"
            icon={<Download size={16} strokeWidth={1.5} />}
            onClick={exportGroup}
            disabled={rows.length === 0}
          >
            {t("exportGroup")}
          </Button>
          <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => setAddOpen(true)}>
            {t("addCustomer")}
          </Button>
        </div>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(c) => c.id}
        loading={rowsQ.loading}
        onRowClick={(c) => router.push(`/customers/${c.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.5}
                className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-9 w-64 max-w-full rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <div className="flex flex-wrap gap-inline">
              {segments.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSegment(s.value)}
                  className={`h-9 rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
                    segment === s.value
                      ? "border-ember bg-ember/10 text-brand-foreground"
                      : "border-line text-muted hover:bg-subtle"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            title={t("emptyTitle")}
            message={search || segment !== "all" ? t("emptyFiltered") : t("emptyMessage")}
          />
        }
      />

      <AddCustomerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          setAddOpen(false);
          router.push(`/customers/${id}`);
        }}
      />
      <DuplicatesModal
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        onMerged={() => {
          rowsQ.reload();
        }}
      />
    </PageShell>
  );
}

// ── add ─────────────────────────────────────────────────────────────────────
function AddCustomerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    setSaving(true);
    const res = await createCustomer({ name, phone, email });
    setSaving(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.name ?? res.error.message);
      return;
    }
    toast.success(t("added", { name: res.data.name }));
    setName("");
    setPhone("");
    setEmail("");
    setError(undefined);
    onCreated(res.data.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("addTitle")}
      description={t("addDescription")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={saving}>
            {t("addCustomer")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        <FormField
          label={t("fieldName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
        />
        <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
          <FormField
            label={t("fieldPhone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            help={t("phoneHelp")}
          />
          <FormField
            label={t("fieldEmail")}
            variant="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

// ── duplicates + merge ──────────────────────────────────────────────────────
function DuplicatesModal({
  open,
  onClose,
  onMerged,
}: {
  open: boolean;
  onClose: () => void;
  onMerged: () => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [nonce, setNonce] = useState(0);
  const dupQ = useApiQuery(() => findDuplicateCustomers(), [open, nonce]);
  const [busy, setBusy] = useState<string | null>(null);

  const merge = async (loser: DuplicateMatch["a"], survivor: DuplicateMatch["b"]) => {
    setBusy(loser.id);
    const res = await mergeCustomers(loser.id, survivor.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("merged", { name: res.data.name }));
    setNonce((n) => n + 1);
    onMerged();
  };

  const pairs = dupQ.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dupTitle")}
      description={t("dupDescription")}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("done")}
        </Button>
      }
    >
      {dupQ.loading && (
        <div className="flex flex-col gap-tight">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-sm bg-subtle" />
          ))}
        </div>
      )}
      {!dupQ.loading && pairs.length === 0 && (
        <EmptyState title={t("dupNoneTitle")} message={t("dupNoneMessage")} />
      )}
      <div className="flex flex-col gap-tight">
        {pairs.map((p) => (
          <div key={`${p.a.id}|${p.b.id}`} className="card-surface p-comfortable">
            <div className="mb-tight flex items-center gap-tight">
              <StatusPill tone={p.confidence === "high" ? "warning" : "neutral"}>
                {t(p.on === "phone" ? "dupOnPhone" : p.on === "email" ? "dupOnEmail" : "dupOnName")}
              </StatusPill>
              <span className="text-[12px] text-muted">
                {t(p.confidence === "high" ? "dupHigh" : "dupMedium")}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-tight sm:grid-cols-2">
              {[p.a, p.b].map((c, idx) => {
                const other = idx === 0 ? p.b : p.a;
                return (
                  <div key={c.id} className="rounded-sm border border-line p-comfortable">
                    <div className="break-words text-sm font-medium">{c.name}</div>
                    <div className="mt-inline text-[12px] text-muted">
                      {c.phone && <div className="font-mono">{c.phone}</div>}
                      {c.email && <div className="break-words">{c.email}</div>}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-tight w-full"
                      loading={busy === other.id}
                      onClick={() => merge(other, c)}
                    >
                      {t("keepThisOne")}
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="mt-tight text-[12px] text-muted">{t("mergeExplain")}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

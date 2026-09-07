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
  StatStrip,
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
import { cn } from "@/lib/cn";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { formatDate, formatMoney } from "@/lib/format";

type Segment = "all" | "flagged" | "email" | "sms";

/** Enough to fill a desktop viewport without rendering a whole tenant.
 *  The page previously asked for 500 rows and drew every one of them. */
const PAGE_SIZE = 25;

export default function CustomersPage() {
  const router = useRouter();
  const t = useTranslations("customers");
  const toast = useToast();
  const compact = !useMediaQuery(MD, true);

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  /* Spent, descending. A customer list is opened to find out who matters, and
     alphabetical answers a question nobody asked. */
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "spent",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);

  const filters = useMemo(() => {
    if (segment === "flagged") return { flagged: true };
    if (segment === "email") return { consent: "email" };
    if (segment === "sms") return { consent: "sms" };
    return {};
  }, [segment]);

  const rowsQ = useApiQuery(
    () => listCustomerRows({ page, pageSize: PAGE_SIZE, search, filters, sort: sort.key, order: sort.order }),
    [search, segment, sort.key, sort.order, page],
  );
  const rows = useMemo(() => rowsQ.data?.data ?? [], [rowsQ.data]);

  /* Export and the summary both describe the whole group the filters match,
     not the page being looked at — an export of "this group" that stopped at
     twenty-five rows would be quietly wrong. */
  const groupQ = useApiQuery(
    () => listCustomerRows({ pageSize: 5000, search, filters }),
    [search, segment],
  );
  const group = useMemo(() => groupQ.data?.data ?? [], [groupQ.data]);

  // §63.10 — a group built from the filters above, exported as it stands.
  const exportGroup = useCallback(() => {
    const header = "Name,Phone,Email,Bookings,Spent,Visits,No-shows,Last seen,Email consent,SMS consent,Tags";
    const body = group.map((c) =>
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
    toast.success(t("exported", { count: group.length }));
  }, [group, segment, t, toast]);

  /* What the group is worth, and how much of it can actually be contacted —
     the second number is the one that decides whether a campaign is worth
     building, and it was nowhere on the page. */
  const summary = useMemo(() => {
    const spent = group.reduce((sum, c) => sum + c.stats.spent, 0);
    const reachable = group.filter((c) => hasConsent(c, "email") || hasConsent(c, "sms")).length;
    return {
      customers: group.length,
      spent,
      average: group.length === 0 ? 0 : Math.round(spent / group.length),
      reachable,
    };
  }, [group]);

  const columns: Column<CustomerWithStats>[] = [
    {
      key: "name",
      header: t("colCustomer"),
      sortable: true,
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
          {!c.phone && !c.email && <span className="text-muted">{t("noContact")}</span>}
        </div>
      ),
    },
    {
      key: "consent",
      header: t("colConsent"),
      /* Consent was two identical glyphs separated only by colour — grey mail
         against green mail — which is status by colour alone and, at 14px,
         barely status at all. A granted channel now carries its own tinted
         chip with a letter; a withheld one is simply absent, which is the
         plainest possible difference. */
      render: (c) => {
        const email = hasConsent(c, "email");
        const sms = hasConsent(c, "sms");
        if (!email && !sms) return <span className="text-[12px] text-muted">{t("consentNone")}</span>;
        return (
          <div className="flex items-center gap-inline">
            {email && (
              <span
                title={t("consentEmailYes")}
                className="flex items-center gap-0.5 rounded-xs bg-success/10 px-1 py-0.5 text-[11px] font-medium text-success"
              >
                <Mail size={11} strokeWidth={2} aria-hidden />
                {t("consentEmailShort")}
              </span>
            )}
            {sms && (
              <span
                title={t("consentSmsYes")}
                className="flex items-center gap-0.5 rounded-xs bg-success/10 px-1 py-0.5 text-[11px] font-medium text-success"
              >
                <Smartphone size={11} strokeWidth={2} aria-hidden />
                {t("consentSmsShort")}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "orders",
      sortable: true,
      header: t("colBookings"),
      align: "right",
      render: (c) => (
        <span className={cn("font-mono", c.stats.orders === 0 && "text-muted")}>{c.stats.orders}</span>
      ),
    },
    {
      key: "spent",
      sortable: true,
      header: t("colSpent"),
      align: "right",
      render: (c) => (
        <span className={cn("font-mono whitespace-nowrap", c.stats.spent === 0 && "text-muted")}>
          {formatMoney(c.stats.spent)}
        </span>
      ),
    },
    {
      key: "lastSeen",
      sortable: true,
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
            disabled={group.length === 0}
          >
            {t("exportGroup")}
          </Button>
          <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => setAddOpen(true)}>
            {t("addCustomer")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-section">
        <StatStrip
          compact={compact}
          loading={groupQ.loading}
          items={[
            { key: "customers", label: t("statCustomers"), value: String(summary.customers) },
            { key: "spent", label: t("statSpent"), value: formatMoney(summary.spent) },
            {
              key: "average",
              label: t("statAverage"),
              value: summary.customers === 0 ? "—" : formatMoney(summary.average),
            },
            {
              key: "reachable",
              label: t("statReachable"),
              value: t("statReachableValue", { count: summary.reachable, total: summary.customers }),
            },
          ]}
        />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(c) => c.id}
        loading={rowsQ.loading}
        sort={sort}
        onSortChange={(key) =>
          setSort((cur) => {
            setPage(1);
            // Money and dates open on their most useful end — biggest spend and
            // most recent visit first — while a name opens A–Z.
            if (cur.key === key) return { key, order: cur.order === "asc" ? "desc" : "asc" };
            return { key, order: key === "name" ? "asc" : "desc" };
          })
        }
        minWidth="62rem"
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: rowsQ.data?.page.total ?? 0,
          onPageChange: setPage,
        }}
        onRowClick={(c) => router.push(`/customers/${c.id}`)}
        toolbar={
          <div className="flex flex-wrap items-center gap-tight">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.5}
                className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("searchPlaceholder")}
                className="h-11 md:h-9 w-64 max-w-full rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
              />
            </div>
            <div className="flex flex-wrap gap-inline">
              {segments.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => { setSegment(s.value); setPage(1); }}
                  className={`h-11 md:h-9 rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
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
      </div>

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

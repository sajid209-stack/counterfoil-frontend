"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Mail, Search, Smartphone } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  FormField,
  Modal,
  StatusPill,
  useToast,
  type Column,
} from "@/components/ui";
import { PageAction, PageShell, PageToolbar, type PagePrimary } from "@/components/ui/PageShell";
import { useApiQuery } from "@/lib/useApi";
import {
  createCustomer,
  hasConsent,
  listCustomerRows,
  type CustomerWithStats,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";

type Segment = "all" | "email" | "sms";

/** Enough to fill a desktop viewport without rendering a whole tenant.
 *  The page previously asked for 500 rows and drew every one of them. */
const PAGE_SIZE = 25;

export default function CustomersPage() {
  const router = useRouter();
  const t = useTranslations("customers");
  const toast = useToast();

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

  const filters = useMemo(() => {
    if (segment === "email") return { consent: "email" };
    if (segment === "sms") return { consent: "sms" };
    return {};
  }, [segment]);

  const rowsQ = useApiQuery(
    () => listCustomerRows({ page, pageSize: PAGE_SIZE, search, filters, sort: sort.key, order: sort.order }),
    [search, segment, sort.key, sort.order, page],
  );
  const rows = useMemo(() => rowsQ.data?.data ?? [], [rowsQ.data]);

  /* The export describes the whole group the filters match, not the page being
     looked at — an export of "this group" that stopped at twenty-five rows
     would be quietly wrong. */
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

  const columns: Column<CustomerWithStats>[] = [
    {
      key: "name",
      header: t("colCustomer"),
      sortable: true,
      render: (c) => (
        <div className="flex min-w-0 items-center gap-tight">
          <span className="min-w-0 break-words font-medium">{c.name}</span>
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
                className="flex items-center gap-0.5 rounded-xs bg-success/10 px-1 py-0.5 text-[12px] font-medium text-success"
              >
                <Mail size={11} strokeWidth={2} aria-hidden />
                {t("consentEmailShort")}
              </span>
            )}
            {sms && (
              <span
                title={t("consentSmsYes")}
                className="flex items-center gap-0.5 rounded-xs bg-success/10 px-1 py-0.5 text-[12px] font-medium text-success"
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
        <span className={cn("tabular-nums", c.stats.orders === 0 && "text-muted")}>{c.stats.orders}</span>
      ),
    },
    {
      key: "spent",
      sortable: true,
      header: t("colSpent"),
      align: "right",
      render: (c) => (
        <span className={cn("whitespace-nowrap tabular-nums", c.stats.spent === 0 && "text-muted")}>
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
        <span className="whitespace-nowrap text-[12px] tabular-nums text-muted">
          {c.stats.lastSeen ? formatDate(c.stats.lastSeen) : "—"}
        </span>
      ),
    },
  ];

  const segments: { value: Segment; label: string }[] = [
    { value: "all", label: t("segAll") },
    { value: "email", label: t("segEmail") },
    { value: "sms", label: t("segSms") },
  ];

  /* The page's one create action: the bar's plus on a phone, and on a desktop
     the button at the right of the toolbar below — Export beside it. There is
     no header row for either. */
  const primary: PagePrimary = { label: t("addCustomer"), onClick: () => setAddOpen(true) };

  return (
    <PageShell title={t("title")} description={t("listDescription")} primary={primary}>
      <div className="flex flex-col gap-section">
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
          <PageToolbar
            primary={primary}
            actions={
              <PageAction
                label={t("exportGroup")}
                icon={<Download size={16} strokeWidth={1.5} />}
                onClick={exportGroup}
                disabled={group.length === 0}
              />
            }
          >
          <FilterBar
            search={
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
                  aria-label={t("searchPlaceholder")}
                  className="h-11 md:h-9 w-full min-w-0 rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none focus:border-inverse md:w-64"
                />
              </div>
            }
            /* Who is reachable is the page's own cut rather than one filter
               among several, so it stays visible at every width — and with one
               filter on this page there is nothing left to fold. */
            filters={[
              {
                key: "consent",
                label: t("filterReach"),
                active: segment === "all" ? null : segments.find((x) => x.value === segment)?.label ?? null,
                onClear: () => { setSegment("all"); setPage(1); },
                control: (
                  <div className="flex flex-wrap gap-inline">
                    {segments.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => { setSegment(s.value); setPage(1); }}
                        aria-pressed={segment === s.value}
                        className={`h-11 md:h-9 rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
                          segment === s.value
                            ? "border-ember bg-ember/10 text-brand-foreground"
                            : "border-line text-muted hover:bg-muted-wash"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ),
              },
            ]}
          />
          </PageToolbar>
        }
        cardVariant="list"
        renderCard={(c) => (
          /* Two lines: who and what they are worth, then how to reach them and
             how often they come. It was six lines and 141px — the generic
             label/value dump, which put an e-mail address and two consent chips
             above the two figures a list is ranked by. Both are on the record,
             and consent is what the segments above filter on. */
          <div className="flex flex-col gap-inline">
            <div className="flex items-baseline justify-between gap-tight">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
              <span className={cn("shrink-0 text-[13px] font-medium tabular-nums", c.stats.spent === 0 && "text-muted")}>
                {formatMoney(c.stats.spent)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-tight text-[12px] text-muted">
              <span className="min-w-0 flex-1 truncate">
                {/* The phone, not the e-mail: two customers share a name far
                    more often than a number, so it is the line that confirms
                    the right person. */}
                {c.phone ? <span className="font-mono">{c.phone}</span> : t("noContact")}
                {" · "}
                {t("ordersCount", { count: c.stats.orders })}
              </span>
              <span className="shrink-0 whitespace-nowrap">
                {c.stats.lastSeen ? formatDate(c.stats.lastSeen) : "—"}
              </span>
            </div>
          </div>
        )}
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

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Mail, Smartphone } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  FilterSearch,
  FormField,
  Modal,
  Select,
  StatusPill,
  useToast,
  type Column,
} from "@/components/ui";
import { PagePrimaryButton, PageShell, type PagePrimary } from "@/components/ui/PageShell";
import { MetaParts, PhoneRow } from "@/components/ui/PhoneRow";
import { QuickTabs } from "@/components/ui/QuickTabs";
import { ToolbarMenu } from "../orders/_components/ToolbarMenu";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { useApiQuery } from "@/lib/useApi";
import {
  createCustomer,
  hasConsent,
  listCustomerRows,
  type CustomerWithStats,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";

const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

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
  const wide = useMediaQuery(MD);

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
        <div className="min-w-0 text-xs text-muted">
          {c.phone && <div className="whitespace-nowrap tabular-nums">{c.phone}</div>}
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
        if (!email && !sms) return <span className="text-xs text-muted">{t("consentNone")}</span>;
        return (
          <div className="flex items-center gap-inline">
            {email && (
              <span
                title={t("consentEmailYes")}
                className="flex items-center gap-0.5 rounded-inner bg-success-wash px-1 py-0.5 text-xs font-medium text-fg"
              >
                <Mail size={11} strokeWidth={2} aria-hidden className="text-success" />
                {t("consentEmailShort")}
              </span>
            )}
            {sms && (
              <span
                title={t("consentSmsYes")}
                className="flex items-center gap-0.5 rounded-inner bg-success-wash px-1 py-0.5 text-xs font-medium text-fg"
              >
                <Smartphone size={11} strokeWidth={2} aria-hidden className="text-success" />
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
        <span className="whitespace-nowrap text-xs tabular-nums text-muted">
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
        toolbarInCard
        toolbar={
          <FilterBar
            pill
            /* The quick filters are the same cut as the Reach filter in the panel. */
            tabs={
              <QuickTabs
                label={t("quick.label")}
                value={segment}
                onChange={(v) => { setSegment(v); setPage(1); }}
                options={[
                  { value: "all", label: t("quick.all") },
                  { value: "email", label: t("quick.email") },
                  { value: "sms", label: t("quick.sms") },
                ]}
              />
            }
            search={
              <FilterSearch
                value={search}
                onChange={(v) => { setSearch(v); setPage(1); }}
                placeholder={t("searchPlaceholder")}
              />
            }
            /* The same row as Orders: search, then a Filters button holding the
               cut (who agreed to messages). There is no key filter inline — a
               segmented select beside the search read as a second search box. */
            filters={[
              {
                key: "consent",
                label: t("filterReach"),
                active: segment === "all" ? null : segments.find((x) => x.value === segment)?.label ?? null,
                onClear: () => { setSegment("all"); setPage(1); },
                control: (
                  <Select
                    size={wide ? "sm" : "md"}
                    className="w-full md:w-52"
                    aria-label={t("filterReach")}
                    value={segment}
                    onChange={(v) => { setSegment(v as Segment); setPage(1); }}
                    options={segments.map((x) => ({ value: x.value, label: x.label }))}
                  />
                ),
              },
            ]}
            /* The page's one action, and a ⋯ for the rest — the way Orders ends
               its row. */
            actions={
              <>
                <PagePrimaryButton primary={primary} />
                <ToolbarMenu
                  label={t("moreActions")}
                  items={[
                    {
                      key: "export",
                      label: t("exportGroup"),
                      icon: <Download size={15} strokeWidth={1.5} aria-hidden />,
                      onSelect: exportGroup,
                      disabled: group.length === 0,
                    },
                  ]}
                />
              </>
            }
          />
        }
        cardVariant="list"
        renderCard={(c) => (
          /* Flat row (docs/mobile.md section 8): the name, then one meta line — the
             phone (not the e-mail: two customers share a name far more often
             than a number, so it is what confirms the right person), how many
             orders, and the last visit — with what they have spent at the right.
             Both other facts are on the record, and consent is what the quick
             filters above cut by. */
          <PhoneRow
            title={c.name}
            meta={
              <MetaParts
                parts={[
                  c.phone ? <span key="p" className="tabular-nums">{c.phone}</span> : t("noContact"),
                  t("ordersCount", { count: c.stats.orders }),
                  /* "3 Nov", not "03 Nov 2026": the long form ran out of room at
                     390px and the year is nearly always this one. */
                  c.stats.lastSeen ? <span key="d" className="whitespace-nowrap">{SHORT_DAY.format(new Date(c.stats.lastSeen))}</span> : null,
                ]}
              />
            }
            trailing={formatMoney(c.stats.spent)}
            trailingMuted={c.stats.spent === 0}
          />
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

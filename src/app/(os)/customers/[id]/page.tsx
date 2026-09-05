"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  Flag,
  Merge,
  ShieldOff,
  StickyNote,
} from "lucide-react";
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
import { useApiQuery } from "@/lib/useApi";
import {
  addCustomerNote,
  eraseCustomerData,
  flagCustomer,
  getCustomer,
  getCustomerStats,
  hasConsent,
  listCustomerRows,
  loyaltyAccount,
  membershipsFor,
  listOrders,
  mergeCustomers,
  setCustomerConsent,
  unflagCustomer,
  updateCustomer,
  type ConsentChannel,
  type Customer,
  type Order,
} from "@/lib/api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { MembershipTab } from "./MembershipTab";

// Who is acting. Real auth lands with the backend; until then the counter
// manager is the actor, exactly as the rest of OS assumes.
const ACTOR = "Nadia Islam";

type Tab = "activity" | "membership" | "details" | "consent" | "notes";

export default function CustomerDetailPage() {
  const t = useTranslations("customers");
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("activity");
  const customerQ = useApiQuery(() => getCustomer(params.id), [params.id]);
  const statsQ = useApiQuery(() => getCustomerStats(params.id), [params.id]);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 500 }), [params.id]);

  const customer = customerQ.data;
  const stats = statsQ.data;
  const orders = useMemo(
    () => (ordersQ.data?.data ?? []).filter((o) => o.customerId === params.id),
    [ordersQ.data, params.id],
  );

  const reloadAll = () => {
    customerQ.reload();
    statsQ.reload();
    ordersQ.reload();
  };

  if (!customerQ.loading && !customer) {
    return (
      <PageShell title={t("title")}>
        <EmptyState
          title={t("notFoundTitle")}
          message={t("notFoundMessage")}
          action={<Button onClick={() => router.push("/customers")}>{t("backToList")}</Button>}
        />
      </PageShell>
    );
  }
  if (!customer || !stats) {
    return (
      <PageShell title={t("title")}>
        <div className="flex flex-col gap-section">
          <div className="h-24 animate-pulse rounded-md bg-line" />
          <div className="h-64 animate-pulse rounded-md bg-line" />
        </div>
      </PageShell>
    );
  }

  const memberships = membershipsFor(customer.id);
  const points = loyaltyAccount(customer.id);

  const tabs = [
    { value: "activity", label: t("tabActivity"), count: orders.length },
    {
      value: "membership",
      label: t("tabMembership"),
      count: memberships.filter((m) => m.effectiveStatus === "active").length,
    },
    { value: "details", label: t("tabDetails") },
    { value: "consent", label: t("tabConsent") },
    { value: "notes", label: t("tabNotes"), count: customer.notes.length },
  ];

  return (
    <PageShell
      title={customer.name}
      description={[customer.phone, customer.email].filter(Boolean).join(" · ") || t("noContact")}
      actions={
        <div className="flex flex-wrap items-center gap-tight">
          <Button
            variant="tertiary"
            icon={<ArrowLeft size={16} strokeWidth={1.5} />}
            onClick={() => router.push("/customers")}
          >
            {t("backToList")}
          </Button>
          <CustomerActions customer={customer} onChanged={reloadAll} />
        </div>
      }
    >
      <div className="flex flex-col gap-major">
        {customer.flag && (
          <div className="flex items-start gap-tight rounded-sm border-l-2 border-warning bg-warning/10 p-comfortable">
            <AlertTriangle size={18} strokeWidth={1.5} className="mt-px shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("flaggedTitle")}</p>
              <p className="break-words text-[13px] text-muted">{customer.flag.reason}</p>
              <p className="mt-inline font-mono text-[12px] text-faint">
                {t("byOn", { who: customer.flag.who, when: formatDate(customer.flag.at) })}
              </p>
            </div>
          </div>
        )}

        {customer.erasedAt && (
          <div className="rounded-sm border border-line bg-subtle p-comfortable text-[13px] text-muted">
            {t("erasedNotice", { when: formatDate(customer.erasedAt) })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-tight sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t("statSpent")} value={formatMoney(stats.spent)} />
          <Stat label={t("statOrders")} value={String(stats.orders)} />
          <Stat label={t("statVisits")} value={String(stats.visits)} />
          <Stat
            label={t("statNoShows")}
            value={String(stats.noShows)}
            tone={stats.noShows > 0 ? "warning" : undefined}
          />
          <Stat
            label={t("statOutstanding")}
            value={formatMoney(stats.outstanding)}
            tone={stats.outstanding > 0 ? "warning" : undefined}
          />
          <Stat label={t("statUpcoming")} value={String(stats.upcoming)} />
        </div>

        <Tabs items={tabs} value={tab} onChange={(v) => setTab(v as Tab)} />

        {tab === "activity" && <ActivityTab orders={orders} loading={ordersQ.loading} stats={stats} />}
        {tab === "membership" && (
          <MembershipTab
            key={`${memberships.length}-${points.balance}`}
            customerId={customer.id}
            memberships={memberships}
            points={points}
            onChanged={reloadAll}
          />
        )}
        {tab === "details" && (
          <DetailsTab key={customer.updatedAt} customer={customer} onSaved={reloadAll} />
        )}
        {tab === "consent" && <ConsentTab customer={customer} onChanged={reloadAll} />}
        {tab === "notes" && <NotesTab customer={customer} onChanged={reloadAll} />}
      </div>
    </PageShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="card-surface p-comfortable">
      <p className="type-label text-[12px] text-muted">{label}</p>
      <p
        className={`mt-inline font-mono text-lg tabular-nums ${
          tone === "warning" ? "text-warning" : "text-fg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ── activity ────────────────────────────────────────────────────────────────
function ActivityTab({
  orders,
  loading,
  stats,
}: {
  orders: Order[];
  loading: boolean;
  stats: { firstSeen: string | null; lastSeen: string | null };
}) {
  const t = useTranslations("customers");
  const router = useRouter();

  const columns: Column<Order>[] = [
    {
      key: "reference",
      header: t("colReference"),
      render: (o) => <span className="font-mono text-[12px] break-all">{o.reference}</span>,
    },
    {
      key: "date",
      header: t("colDate"),
      render: (o) => (
        <span className="whitespace-nowrap text-[13px]">{formatDate(o.createdAt)}</span>
      ),
    },
    {
      key: "items",
      header: t("colItems"),
      render: (o) => (
        <span className="line-clamp-2 break-words text-[13px] text-muted">
          {o.lines
            .filter((l) => !l.parentLineId)
            .map((l) => `${l.quantity} × ${l.productName}`)
            .join(", ")}
        </span>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      render: (o) => <StatusPill status={o.status}>{o.status.replace(/_/g, " ")}</StatusPill>,
    },
    {
      key: "total",
      header: t("colTotal"),
      align: "right",
      render: (o) => (
        <span className="font-mono whitespace-nowrap">{formatMoney(o.total)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-section">
      {(stats.firstSeen || stats.lastSeen) && (
        <p className="text-[13px] text-muted">
          {t("seenBetween", {
            first: stats.firstSeen ? formatDate(stats.firstSeen) : "—",
            last: stats.lastSeen ? formatDate(stats.lastSeen) : "—",
          })}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={orders}
        getRowId={(o) => o.id}
        loading={loading}
        onRowClick={(o) => router.push(`/orders/${o.id}`)}
        emptyState={<EmptyState title={t("noOrdersTitle")} message={t("noOrdersMessage")} />}
      />
    </div>
  );
}

// ── details ─────────────────────────────────────────────────────────────────
function DetailsTab({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [tags, setTags] = useState(customer.tags.join(", "));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await updateCustomer(customer.id, {
      name,
      phone,
      email,
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("detailsSaved"));
    onSaved();
  };

  return (
    <div className="max-w-3xl">
      <div className="card-surface flex flex-col gap-section p-section">
        <FormField label={t("fieldName")} value={name} onChange={(e) => setName(e.target.value)} />
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
        <FormField
          label={t("fieldTags")}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          help={t("tagsHelp")}
        />
        <div>
          <Button onClick={save} loading={saving}>
            {t("saveDetails")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── consent ─────────────────────────────────────────────────────────────────
function ConsentTab({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [busy, setBusy] = useState<ConsentChannel | null>(null);

  const toggle = async (channel: ConsentChannel) => {
    const next = !hasConsent(customer, channel);
    setBusy(channel);
    // Recorded by a manager on this screen — the source is part of the proof.
    const res = await setCustomerConsent(customer.id, channel, next, "manager");
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(next ? t("consentGranted") : t("consentWithdrawn"));
    onChanged();
  };

  const history = [...customer.consents].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  return (
    <div className="flex max-w-3xl flex-col gap-section">
      <div className="card-surface flex flex-col gap-comfortable p-section">
        <p className="text-[13px] text-muted">{t("consentExplain")}</p>
        {(["email", "sms"] as ConsentChannel[]).map((channel) => (
          <div
            key={channel}
            className="flex flex-wrap items-center justify-between gap-tight rounded-sm border border-line p-comfortable"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {channel === "email" ? t("channelEmail") : t("channelSms")}
              </p>
              <p className="text-[12px] text-muted">
                {hasConsent(customer, channel) ? t("consentYes") : t("consentNo")}
              </p>
            </div>
            <Button
              variant={hasConsent(customer, channel) ? "secondary" : "primary"}
              size="sm"
              loading={busy === channel}
              onClick={() => toggle(channel)}
            >
              {hasConsent(customer, channel) ? t("withdraw") : t("grant")}
            </Button>
          </div>
        ))}
      </div>

      <div className="card-surface p-section">
        <p className="type-label mb-comfortable text-[12px] text-muted">{t("consentHistory")}</p>
        {history.length === 0 && <p className="text-[13px] text-faint">{t("consentNoHistory")}</p>}
        <ul className="flex flex-col gap-tight">
          {history.map((c, i) => (
            <li key={`${c.channel}-${c.capturedAt}-${i}`} className="flex flex-wrap items-baseline gap-tight text-[13px]">
              <StatusPill tone={c.granted ? "success" : "neutral"}>
                {c.granted ? t("granted") : t("withdrawn")}
              </StatusPill>
              <span>{c.channel === "email" ? t("channelEmail") : t("channelSms")}</span>
              <span className="font-mono text-[12px] text-faint">
                {formatDateTime(c.capturedAt)} · {t(`source_${c.source}` as "source_counter")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── notes ───────────────────────────────────────────────────────────────────
function NotesTab({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    const res = await addCustomerNote(customer.id, text, ACTOR);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.text ?? res.error.message);
      return;
    }
    setText("");
    toast.success(t("noteAdded"));
    onChanged();
  };

  const notes = [...customer.notes].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex max-w-3xl flex-col gap-section">
      <div className="card-surface flex flex-col gap-comfortable p-section">
        <FormField
          label={t("addNote")}
          variant="textarea"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          help={t("noteHelp")}
        />
        <div>
          <Button onClick={add} loading={saving} disabled={!text.trim()}>
            {t("saveNote")}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={<StickyNote size={20} strokeWidth={1.5} />}
          title={t("noNotesTitle")}
          message={t("noNotesMessage")}
        />
      ) : (
        <ul className="flex flex-col gap-tight">
          {notes.map((n, i) => (
            <li key={`${n.at}-${i}`} className="card-surface p-comfortable">
              <p className="break-words text-[13px]">{n.text}</p>
              <p className="mt-inline font-mono text-[12px] text-faint">
                {n.who} · {formatDateTime(n.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── record actions: flag, merge, erase ──────────────────────────────────────
function CustomerActions({
  customer,
  onChanged,
}: {
  customer: Customer;
  onChanged: () => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const router = useRouter();

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const doFlag = async () => {
    setBusy(true);
    const res = await flagCustomer(customer.id, flagReason, ACTOR);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.reason ?? res.error.message);
      return;
    }
    setFlagOpen(false);
    setFlagReason("");
    toast.success(t("flagged"));
    onChanged();
  };

  const doUnflag = async () => {
    const res = await unflagCustomer(customer.id);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("unflagged"));
    onChanged();
  };

  const doErase = async () => {
    setBusy(true);
    const res = await eraseCustomerData(customer.id, ACTOR);
    setBusy(false);
    setEraseOpen(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("erased"));
    onChanged();
  };

  return (
    <>
      {customer.flag ? (
        <Button variant="secondary" icon={<Flag size={16} strokeWidth={1.5} />} onClick={doUnflag}>
          {t("removeFlag")}
        </Button>
      ) : (
        <Button
          variant="secondary"
          icon={<Flag size={16} strokeWidth={1.5} />}
          onClick={() => setFlagOpen(true)}
        >
          {t("flagCustomer")}
        </Button>
      )}
      <Button
        variant="secondary"
        icon={<Merge size={16} strokeWidth={1.5} />}
        onClick={() => setMergeOpen(true)}
      >
        {t("mergeInto")}
      </Button>
      <Button
        variant="tertiary"
        icon={<ShieldOff size={16} strokeWidth={1.5} />}
        onClick={() => setEraseOpen(true)}
        disabled={!!customer.erasedAt}
      >
        {t("eraseData")}
      </Button>

      <Modal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        title={t("flagTitle")}
        description={t("flagDescription")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFlagOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={doFlag} loading={busy}>
              {t("flagCustomer")}
            </Button>
          </>
        }
      >
        <FormField
          label={t("flagReason")}
          variant="textarea"
          rows={3}
          value={flagReason}
          onChange={(e) => setFlagReason(e.target.value)}
          help={t("flagReasonHelp")}
        />
      </Modal>

      <MergeIntoModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        customer={customer}
        onMerged={(survivorId) => {
          setMergeOpen(false);
          router.push(`/customers/${survivorId}`);
        }}
      />

      <ConfirmDialog
        open={eraseOpen}
        onClose={() => setEraseOpen(false)}
        onConfirm={doErase}
        loading={busy}
        destructive
        title={t("eraseTitle")}
        message={t("eraseMessage")}
        confirmLabel={t("eraseConfirm")}
      />
    </>
  );
}

function MergeIntoModal({
  open,
  onClose,
  customer,
  onMerged,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  onMerged: (survivorId: string) => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const candidatesQ = useApiQuery(
    () => listCustomerRows({ pageSize: 20, search }),
    [search, open],
  );
  const candidates = (candidatesQ.data?.data ?? []).filter((c) => c.id !== customer.id);

  const doMerge = async (survivorId: string) => {
    setBusy(survivorId);
    const res = await mergeCustomers(customer.id, survivorId);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("merged", { name: res.data.name }));
    onMerged(survivorId);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("mergeTitle", { name: customer.name })}
      description={t("mergeDescription")}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
      }
    >
      <div className="flex flex-col gap-section">
        <FormField
          label={t("mergeSearch")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
        />
        {candidatesQ.loading && <div className="h-24 animate-pulse rounded-sm bg-subtle" />}
        {!candidatesQ.loading && candidates.length === 0 && (
          <p className="text-[13px] text-faint">{t("mergeNoCandidates")}</p>
        )}
        <ul className="flex flex-col gap-tight">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-tight rounded-sm border border-line p-comfortable"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{c.name}</p>
                <p className="text-[12px] text-muted">
                  {[c.phone, c.email].filter(Boolean).join(" · ") || t("noContact")}
                </p>
                <p className="font-mono text-[12px] text-faint">
                  {t("ordersAndSpend", {
                    orders: c.stats.orders,
                    spent: formatMoney(c.stats.spent),
                  })}
                </p>
              </div>
              <Button size="sm" loading={busy === c.id} onClick={() => doMerge(c.id)}>
                {t("mergeIntoThis")}
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-muted">{t("mergeExplain")}</p>
      </div>
    </Modal>
  );
}

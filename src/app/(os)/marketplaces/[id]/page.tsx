"use client";

/**
 * One marketplace: what it costs, what is listed on it, and what it brought in.
 *
 * The listing table is the working surface. Its columns are the four things a
 * supplier checks — what is listed, what the guest pays there, what reaches
 * the operator, and whether the marketplace has accepted it — because a table
 * of names and statuses answers none of the questions the page exists for.
 *
 * Two rules worth stating because they shape the screen:
 *
 *  1. **Nothing can be listed that cannot be sold.** A booking with no price
 *     or no schedule would be refused by the marketplace, or worse accepted
 *     and left unfulfillable, so the picker greys it out with the same
 *     blockers the catalogue already shows on the row.
 *
 *  2. **Submitting is not publishing.** A marketplace reviews a listing and
 *     can refuse it. Drafts are sent for review; the state that resolves them
 *     comes back from the channel, and the screen never pretends otherwise.
 */
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, RefreshCw, Send } from "lucide-react";
import {
  ActionMenu,
  Button,
  ConfirmDialog,
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
  addListing,
  disconnectMarketplace,
  getConnection,
  listProducts,
  listResources,
  listingSplit,
  listingsFor,
  performanceOf,
  removeListing,
  submitListings,
  syncConnection,
  updateConnection,
  updateListing,
} from "@/lib/api";
import type { MarketplaceListing, Product } from "@/lib/api";
import { bpsToPct, marketplaceById, pctToBps, priceToNet, split } from "@/lib/marketplaces";
import { sellingBlockers } from "@/lib/sellable";
import { formatMoney } from "@/lib/format";
import { formatDateTime } from "@/lib/format";

const EXAMPLE = 150000;

export default function MarketplacePage() {
  const t = useTranslations("marketplaces");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => getConnection(params.id), [params.id]);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 300 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);

  const [tick, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [pct, setPct] = useState<string | null>(null);

  const conn = q.data;
  const meta = conn ? marketplaceById(conn.marketplaceId) : null;
  const listings = useMemo(
    () => (conn ? listingsFor(conn.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived from the store; `tick` is when it can have moved
    [conn, tick],
  );
  const perf = conn ? performanceOf(conn.marketplaceId) : null;
  const products = productsQ.data?.data ?? [];
  const resources = resourcesQ.data?.data ?? [];

  if (q.loading) {
    return <PageShell title={t("title")}><div className="h-72 animate-pulse rounded-md bg-subtle" /></PageShell>;
  }
  if (!conn || !meta || !perf) {
    return (
      <PageShell title={t("title")}>
        <EmptyState title={t("missing")} action={<Button onClick={() => router.push("/marketplaces")}>{t("backToList")}</Button>} />
      </PageShell>
    );
  }

  const reload = () => { setTick((n) => n + 1); q.reload(); };
  const s = split(EXAMPLE, conn.commissionBps);
  const drafts = listings.filter((l) => l.status === "draft");

  const saveCommission = async () => {
    if (pct == null) return;
    const bps = pctToBps(parseFloat(pct) || 0);
    setBusy(true);
    const res = await updateConnection(conn.id, { commissionBps: bps });
    setBusy(false);
    if (res.ok) { toast.success(t("commissionSaved")); setPct(null); reload(); }
    else toast.error(res.error.message);
  };

  const send = async () => {
    setBusy(true);
    const res = await submitListings(conn.id, drafts.map((l) => l.id));
    setBusy(false);
    if (res.ok) { toast.success(t("submitted", { count: res.data.submitted })); reload(); }
    else toast.error(res.error.message);
  };

  const columns: Column<MarketplaceListing>[] = [
    {
      key: "productName",
      header: t("col.listing"),
      render: (l) => (
        <div className="min-w-0">
          <span className="block truncate font-medium">{l.productName}</span>
          {l.rejectedReason && <span className="block text-[12px] text-danger">{l.rejectedReason}</span>}
        </div>
      ),
    },
    {
      key: "price",
      header: t("col.theirPrice"),
      align: "right",
      render: (l) => <span className="tabular-nums">{formatMoney(listingSplit(l, conn).price)}</span>,
    },
    {
      key: "net",
      header: t("col.youKeep"),
      align: "right",
      render: (l) => {
        const sp = listingSplit(l, conn);
        return (
          <span className="tabular-nums">
            {formatMoney(sp.net)}
            <span className="block text-[12px] text-muted">{t("lessCommission", { amount: formatMoney(sp.commission) })}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("col.status"),
      render: (l) => (
        <StatusPill
          tone={l.status === "live" ? "success" : l.status === "rejected" ? "danger" : l.status === "submitted" ? "info" : "neutral"}
        >
          {t(`listing.${l.status}`)}
        </StatusPill>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (l) => (
        <ActionMenu
          label={t("rowActions", { name: l.productName })}
          items={[
            l.status === "live"
              ? { key: "pause", label: t("pause"), onSelect: async () => { await updateListing(l.id, { status: "paused" }); reload(); } }
              : l.status === "paused"
                ? { key: "resume", label: t("resume"), onSelect: async () => { await updateListing(l.id, { status: "live" }); reload(); } }
                : {
                    key: "send",
                    label: t("sendOne"),
                    disabled: l.status !== "draft",
                    /* A greyed item that says nothing reads as a fault. */
                    hint: l.status === "submitted" ? t("sendHintSubmitted") : l.status === "rejected" ? t("sendHintRejected") : undefined,
                    onSelect: async () => { await submitListings(conn.id, [l.id]); reload(); },
                  },
            {
              key: "remove",
              label: t("removeListing"),
              destructive: true,
              separated: true,
              onSelect: async () => { await removeListing(l.id); toast.success(t("listingRemoved")); reload(); },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <PageShell
      title={meta.name}
      description={t("oneDescription", { name: meta.name })}
      actions={
        <div className="flex flex-wrap gap-tight">
          {drafts.length > 0 && (
            <Button loading={busy} icon={<Send size={15} strokeWidth={1.5} />} onClick={send}>
              {t("sendDrafts", { count: drafts.length })}
            </Button>
          )}
          <Button variant="secondary" icon={<Plus size={15} strokeWidth={1.5} />} onClick={() => setAdding(true)}>
            {t("addListing")}
          </Button>
        </div>
      }
    >
      <button type="button" onClick={() => router.push("/marketplaces")} className="mb-section inline-flex min-h-11 items-center gap-inline text-[13px] text-muted hover:text-fg sm:min-h-0">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("backToList")}
      </button>

      <div className="mb-section">
        <StatStrip
          items={[
            { key: "listed", label: t("stat.listed"), value: String(listings.length), context: t("stat.liveOf", { count: listings.filter((l) => l.status === "live").length }) },
            { key: "orders", label: t("stat.orders"), value: String(perf.orders) },
            { key: "net", label: t("stat.net"), value: formatMoney(perf.net) },
            { key: "commission", label: t("stat.commission"), value: formatMoney(perf.commission) },
          ]}
        />
      </div>

      <div className="flex flex-col gap-section">
        {/* The contract. One card, because the commission is the whole deal. */}
        <section className="card-surface p-card" aria-labelledby="mk-terms">
          <div className="mb-section flex flex-wrap items-center gap-tight">
            <h2 id="mk-terms" className="mr-auto text-base font-semibold tracking-[-0.4px]">{t("terms")}</h2>
            <StatusPill tone={conn.status === "connected" ? "success" : conn.status === "attention" ? "warning" : "info"}>{t(`status.${conn.status}`)}</StatusPill>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={14} strokeWidth={1.5} />} onClick={async () => { await syncConnection(conn.id); toast.success(t("synced", { name: meta.name })); reload(); }}>
              {t("sync")}
            </Button>
          </div>
          <div className="grid gap-section sm:grid-cols-2">
            <div>
              <FormField
                label={t("dialog.commission")}
                variant="number"
                value={pct ?? String(bpsToPct(conn.commissionBps))}
                onChange={(e) => setPct(e.target.value)}
                help={t("dialog.commissionHelp")}
              />
              {pct != null && (
                <div className="mt-tight flex gap-tight">
                  <Button size="sm" loading={busy} onClick={saveCommission}>{t("save")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setPct(null)}>{t("dialog.cancel")}</Button>
                </div>
              )}
            </div>
            <dl className="flex flex-col gap-tight text-[13px]">
              {/* The two questions a commission raises, answered in money. */}
              <div>
                <dt className="type-label text-[12px] text-muted">{t("onAExample")}</dt>
                <dd className="mt-inline">{t("dialog.example", { price: formatMoney(s.price), commission: formatMoney(s.commission), net: formatMoney(s.net) })}</dd>
              </div>
              <div>
                <dt className="type-label text-[12px] text-muted">{t("toMatchTitle")}</dt>
                <dd className="mt-inline">{t("toMatch", { target: formatMoney(EXAMPLE), list: formatMoney(priceToNet(EXAMPLE, conn.commissionBps)) })}</dd>
              </div>
              {conn.lastSyncedAt && (
                <div>
                  <dt className="type-label text-[12px] text-muted">{t("lastSync")}</dt>
                  <dd className="mt-inline">{formatDateTime(conn.lastSyncedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="mt-section border-t border-hairline pt-comfortable">
            <Button size="sm" variant="destructive" onClick={() => setConfirmOff(true)}>{t("disconnect")}</Button>
          </div>
        </section>

        {/* The listings */}
        <section aria-labelledby="mk-listings">
          <h2 id="mk-listings" className="type-label mb-tight">{t("listingsTitle")}</h2>
          {listings.length === 0 ? (
            <EmptyState
              title={t("noListings.title")}
              message={t("noListings.body", { name: meta.name })}
              action={<Button onClick={() => setAdding(true)}>{t("addListing")}</Button>}
            />
          ) : (
            <DataTable
              rows={listings}
              columns={columns}
              getRowId={(l) => l.id}
              renderCard={(l) => {
                const sp = listingSplit(l, conn);
                return (
                  <div className="flex flex-col gap-inline">
                    <span className="font-medium">{l.productName}</span>
                    <span className="text-[13px] text-muted">
                      {t("theirPriceShort", { price: formatMoney(sp.price) })} · {t("youKeepShort", { net: formatMoney(sp.net) })}
                    </span>
                    <StatusPill tone={l.status === "live" ? "success" : l.status === "rejected" ? "danger" : l.status === "submitted" ? "info" : "neutral"}>{t(`listing.${l.status}`)}</StatusPill>
                  </div>
                );
              }}
            />
          )}
        </section>
      </div>

      {adding && (
        <AddListingDialog
          products={products}
          resources={resources}
          already={new Set(listings.map((l) => l.productId))}
          commissionBps={conn.commissionBps}
          onClose={() => setAdding(false)}
          onAdd={async (id) => {
            const res = await addListing(conn.id, id);
            if (res.ok) { toast.success(t("listingAdded")); reload(); }
            else toast.error(res.error.message);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmOff}
        title={t("disconnectTitle", { name: meta.name })}
        message={t("disconnectBody", { name: meta.name, count: listings.length })}
        confirmLabel={t("disconnect")}
        onConfirm={async () => {
          const res = await disconnectMarketplace(conn.id);
          setConfirmOff(false);
          if (res.ok) { toast.success(t("disconnected", { name: meta.name })); router.push("/marketplaces"); }
          else toast.error(res.error.message);
        }}
        onClose={() => setConfirmOff(false)}
      />
    </PageShell>
  );
}

/** The picker. Anything that could not be sold is greyed out WITH ITS REASON —
 *  a disabled row that says nothing reads as a fault rather than a rule. */
function AddListingDialog({
  products,
  resources,
  already,
  commissionBps,
  onClose,
  onAdd,
}: {
  products: Product[];
  resources: { id: string; status: string }[];
  already: Set<string>;
  commissionBps: number;
  onClose: () => void;
  onAdd: (productId: string) => Promise<void>;
}) {
  const t = useTranslations("marketplaces");
  const [q, setQ] = useState("");
  const rows = products
    .filter((p) => p.status === "active")
    .filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal open onClose={onClose} title={t("add.title")} description={t("add.body")} size="lg">
      <FormField label={t("add.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-section flex max-h-[50vh] flex-col gap-tight overflow-y-auto">
        {rows.map((p) => {
          const listed = already.has(p.id);
          const blockers = sellingBlockers(p, resources as never);
          const cheapest = p.tiers.filter((x) => x.active).map((x) => x.price).sort((a, b) => a - b)[0] ?? 0;
          const sp = split(cheapest, commissionBps);
          const stopped = listed || blockers.length > 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={stopped}
                onClick={() => onAdd(p.id)}
                className="flex min-h-11 w-full items-center gap-tight rounded-sm border border-line p-comfortable text-left hover:bg-muted-wash disabled:opacity-60 disabled:hover:bg-transparent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-[12px] text-muted">
                    {listed
                      ? t("add.already")
                      : blockers.length
                        ? t("add.cannot", { why: blockers.map((b) => t(`blocker.${b}`)).join(", ") })
                        : t("add.split", { price: formatMoney(sp.price), net: formatMoney(sp.net) })}
                  </span>
                </span>
                {!stopped && <Plus size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-section flex justify-end">
        <Button variant="secondary" onClick={onClose}>{t("add.done")}</Button>
      </div>
    </Modal>
  );
}

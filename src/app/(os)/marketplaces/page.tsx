"use client";

/**
 * Marketplaces — the channel manager.
 *
 * What the research settled, and what this page is therefore built around:
 * every tours-and-attractions channel manager (Rezdy, Bokun, TrekkSoft,
 * FareHarbor) is the same three things — a CONNECTION to a marketplace with a
 * commission agreed by contract, a LISTING per catalogue item, and a SYNC. So
 * those are the three objects on screen and there is nothing else.
 *
 * The decision this page exists to support is not "connect Viator". It is
 * **"is it worth it?"** — a marketplace takes a quarter of the ticket and
 * brings customers the operator would not have had. So the money is stated the
 * way it is decided: not "25% commission" but "you keep ৳1,125 of ৳1,500", and
 * beside it what the channel has actually brought in. That is the same
 * mandatory-concrete-numbers rule the duration engine and the pricing preview
 * already follow.
 *
 * Nothing here pretends to talk to Viator. The contract is real and every rule
 * that does not need the network is enforced; a button that claimed to have
 * pushed prices somewhere would be the worst kind of lie on this screen, so
 * Sync says exactly what it did.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import { Button, EmptyState, FormField, Modal, PageShell, StatStrip, StatusPill, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  connectMarketplace,
  connectionIssue,
  listConnections,
  listingCounts,
  performanceOf,
  syncConnection,
} from "@/lib/api";
import type { MarketplaceConnection, MarketplaceId } from "@/lib/api";
import { bpsToPct, MARKETPLACES, marketplaceById, pctToBps, split } from "@/lib/marketplaces";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

/** The worked example every commission field carries. A round number an
 *  operator recognises beats a real price they have to look up. */
const EXAMPLE: number = 150000;

export default function MarketplacesPage() {
  const t = useTranslations("marketplaces");
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => listConnections(), []);
  const [connecting, setConnecting] = useState<MarketplaceId | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  /* Memoised so the totals below do not recompute on every render: a bare
     `?? []` is a new array each time. */
  const connections = useMemo(() => q.data ?? [], [q.data]);
  const connected = new Set(connections.map((c) => c.marketplaceId));
  const available = MARKETPLACES.filter((m) => !connected.has(m.id));

  const totals = useMemo(() => {
    let orders = 0;
    let net = 0;
    let commission = 0;
    let live = 0;
    for (const c of connections) {
      const p = performanceOf(c.marketplaceId);
      orders += p.orders;
      net += p.net;
      commission += p.commission;
      live += listingCounts(c.id).live;
    }
    return { orders, net, commission, live };
  }, [connections]);

  const doSync = async (c: MarketplaceConnection) => {
    setSyncing(c.id);
    const res = await syncConnection(c.id);
    setSyncing(null);
    if (res.ok) {
      toast.success(t("synced", { name: marketplaceById(c.marketplaceId).name }));
      q.reload();
    } else toast.error(res.error.message);
  };

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        available.length > 0 ? (
          <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => setConnecting(available[0].id)}>
            {t("connect")}
          </Button>
        ) : undefined
      }
    >
      {connections.length > 0 && (
        <div className="mb-section">
          <StatStrip
            items={[
              { key: "live", label: t("stat.live"), value: String(totals.live) },
              { key: "orders", label: t("stat.orders"), value: String(totals.orders) },
              { key: "net", label: t("stat.net"), value: formatMoney(totals.net) },
              { key: "commission", label: t("stat.commission"), value: formatMoney(totals.commission) },
            ]}
          />
        </div>
      )}

      {q.loading ? (
        <div aria-busy="true" className="grid gap-section sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-md bg-subtle" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-section">
          {/* Connected — what is actually selling */}
          {connections.length === 0 ? (
            <EmptyState title={t("empty.title")} message={t("empty.body")} />
          ) : (
            <section aria-labelledby="mk-connected">
              <h2 id="mk-connected" className="type-label mb-tight">{t("connectedTitle")}</h2>
              <div className="grid gap-section sm:grid-cols-2">
                {connections.map((c) => {
                  const meta = marketplaceById(c.marketplaceId);
                  const counts = listingCounts(c.id);
                  const perf = performanceOf(c.marketplaceId);
                  const issue = connectionIssue(c);
                  const s = split(EXAMPLE, c.commissionBps);
                  return (
                    <article key={c.id} className="flex flex-col gap-tight card-surface p-card">
                      <div className="flex items-start gap-tight">
                        <h3 className="mr-auto min-w-0 truncate font-medium">{meta.name}</h3>
                        <StatusPill tone={c.status === "connected" ? "success" : c.status === "attention" ? "warning" : "info"}>
                          {t(`status.${c.status}`)}
                        </StatusPill>
                      </div>
                      {/* The money, the way it is decided. */}
                      <p className="text-[13px] text-muted">
                        {t("keepOf", {
                          pct: bpsToPct(c.commissionBps),
                          net: formatMoney(s.net),
                          price: formatMoney(s.price),
                        })}
                      </p>
                      <p className="text-[13px]">
                        {t("listingLine", { live: counts.live, total: Object.values(counts).reduce((a, b) => a + b, 0) })}
                        {issue && <span className="text-warning"> · {issue}</span>}
                      </p>
                      {perf.orders > 0 && (
                        <p className="text-[13px] text-muted">
                          {t("broughtIn", { orders: perf.orders, net: formatMoney(perf.net) })}
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap gap-tight pt-tight">
                        <Button size="sm" onClick={() => router.push(`/marketplaces/${c.id}`)}>{t("manage")}</Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={syncing === c.id}
                          icon={<RefreshCw size={14} strokeWidth={1.5} />}
                          onClick={() => doSync(c)}
                        >
                          {t("sync")}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Not connected — what else is out there */}
          {available.length > 0 && (
            <section aria-labelledby="mk-available">
              <h2 id="mk-available" className="type-label mb-tight">{t("availableTitle")}</h2>
              <div className="grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
                {available.map((m) => (
                  <article key={m.id} className="flex flex-col gap-inline rounded-sm border border-line p-comfortable">
                    <h3 className="font-medium">{m.name}</h3>
                    <p className="text-[12px] text-muted">
                      {t(`sells.${m.sells}`)} · {t("typically", { pct: bpsToPct(m.typicalBps) })}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-tight pt-tight">
                      <Button size="sm" variant="secondary" onClick={() => setConnecting(m.id)}>{t("connectOne")}</Button>
                      <a
                        href={m.helpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-inline text-[12px] text-brand-foreground underline underline-offset-2 sm:min-h-0"
                      >
                        {t("theirSite")} <ArrowUpRight size={12} strokeWidth={1.5} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {connecting && (
        <ConnectDialog
          marketplaceId={connecting}
          onClose={() => setConnecting(null)}
          onDone={(id) => {
            setConnecting(null);
            q.reload();
            router.push(`/marketplaces/${id}`);
          }}
        />
      )}
    </PageShell>
  );
}

/* ── Connecting ──────────────────────────────────────────────────────────── */

/**
 * The onboarding, in one step rather than a wizard.
 *
 * The research describes a long real-world process — apply, be accepted,
 * agree a contract, then connect — but only the last part is Counterfoil's.
 * Pretending to own the application would be inventing a flow that ends at
 * somebody else's website, so the dialog says plainly what has to have
 * happened first and links there.
 */
function ConnectDialog({
  marketplaceId,
  onClose,
  onDone,
}: {
  marketplaceId: MarketplaceId;
  onClose: () => void;
  onDone: (connectionId: string) => void;
}) {
  const t = useTranslations("marketplaces");
  const toast = useToast();
  const [which, setWhich] = useState<MarketplaceId>(marketplaceId);
  const meta = marketplaceById(which);
  const [pct, setPct] = useState(String(bpsToPct(meta.typicalBps)));
  const [account, setAccount] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bps = pctToBps(parseFloat(pct) || 0);
  const s = split(EXAMPLE, bps);
  const valid = bps >= 0 && bps < 10000;

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await connectMarketplace({
      marketplaceId: which,
      commissionBps: bps,
      accountRef: account.trim() || undefined,
      apiKey: key.trim() || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(t("connected", { name: meta.name }));
      onDone(res.data.id);
    } else setError(res.error.message);
  };

  return (
    <Modal open onClose={onClose} title={t("dialog.title")} description={t("dialog.body")}>
      <div className="flex flex-col gap-section">
        <FormField
          label={t("dialog.which")}
          variant="select"
          value={which}
          options={MARKETPLACES.map((m) => ({ value: m.id, label: m.name }))}
          onChange={(e) => {
            const id = e.target.value as MarketplaceId;
            setWhich(id);
            setPct(String(bpsToPct(marketplaceById(id).typicalBps)));
          }}
        />

        {/* What must already be true. Said before the fields, because finding
            out afterwards is what makes an onboarding feel like a trap. */}
        <div className="rounded-sm border border-line bg-subtle p-comfortable text-[13px]">
          <p className="font-medium">{t("dialog.firstTitle", { name: meta.name })}</p>
          <p className="mt-inline text-muted">{t("dialog.firstBody", { name: meta.name })}</p>
          <a
            href={meta.helpUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-tight inline-flex min-h-11 items-center gap-inline text-brand-foreground underline underline-offset-2 sm:min-h-0"
          >
            {t("dialog.open", { name: meta.name })} <ArrowUpRight size={13} strokeWidth={1.5} />
          </a>
        </div>

        <FormField
          label={t("dialog.commission")}
          variant="number"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          help={t("dialog.commissionHelp")}
          error={valid ? undefined : t("dialog.commissionBad")}
        />
        {/* The worked example. A commission is a percentage until it is stated
            as money, and then it is a decision. */}
        {valid && (
          <p className="-mt-tight text-[13px] text-muted">
            {t("dialog.example", { price: formatMoney(s.price), commission: formatMoney(s.commission), net: formatMoney(s.net) })}
          </p>
        )}

        {meta.needs === "apiKey" ? (
          <FormField label={t("dialog.apiKey")} value={key} onChange={(e) => setKey(e.target.value)} help={t("dialog.apiKeyHelp")} />
        ) : (
          <FormField label={t("dialog.account")} value={account} onChange={(e) => setAccount(e.target.value)} help={t("dialog.accountHelp")} />
        )}

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className={cn("flex flex-wrap gap-tight")}>
          <Button loading={busy} onClick={go}>{t("dialog.connect")}</Button>
          <Button variant="secondary" onClick={onClose}>{t("dialog.cancel")}</Button>
        </div>
      </div>
    </Modal>
  );
}

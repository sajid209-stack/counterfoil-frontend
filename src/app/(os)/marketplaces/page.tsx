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
 * Cards only on the Dashboard, Finances and Analytics (the owner's rule), so the
 * figures a card band would have carried are one quiet line under the title.
 *
 * Nothing here pretends to talk to Viator. The contract is real and every rule
 * that does not need the network is enforced; a button that claimed to have
 * pushed prices somewhere would be the worst kind of lie on this screen, so
 * Sync says exactly what it did.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ActionMenu, Button, EmptyState, StatusPill, useToast } from "@/components/ui";
import { PageShell, PageToolbar } from "@/components/ui/PageShell";
import { useApiQuery } from "@/lib/useApi";
import {
  connectionIssue,
  listConnections,
  listingCounts,
  performanceOf,
  syncConnection,
} from "@/lib/api";
import type { MarketplaceConnection, MarketplaceId } from "@/lib/api";
import { bpsToPct, MARKETPLACES, marketplaceById, split } from "@/lib/marketplaces";
import { formatMoney } from "@/lib/format";
import { ConnectDialog } from "./_components/ConnectDialog";

/** The worked example every commission field carries. A round number an
 *  operator recognises beats a real price they have to look up. */
const EXAMPLE: number = 150000;

export default function MarketplacesPage() {
  const t = useTranslations("marketplaces");
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => listConnections(), []);
  /* `pick` is whether the operator is choosing the site. The general "Connect a
     site" asks which; a site's own Connect already knows. */
  const [connecting, setConnecting] = useState<{ id: MarketplaceId; pick: boolean } | null>(null);
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

  /* The general Connect: the operator is choosing, so the dialog keeps its
     dropdown. On a phone this is the plus in the top bar; from md it is the
     button on the page's own toolbar, beside the summary line. */
  const connectPrimary =
    available.length > 0 ? { label: t("connect"), onClick: () => setConnecting({ id: available[0].id, pick: true }) } : undefined;

  return (
    <PageShell title={t("title")} description={t("description")} primary={connectPrimary}>
      <PageToolbar primary={connectPrimary} className="mb-section">
        {connections.length > 0 && (
          <p data-mk-summary className="text-[13px] text-muted md:leading-9">
            {t("summary", {
              live: totals.live,
              orders: totals.orders,
              net: formatMoney(totals.net),
              commission: formatMoney(totals.commission),
            })}
          </p>
        )}
      </PageToolbar>

      {q.loading ? (
        <div aria-busy="true" className="grid gap-section sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-md bg-subtle" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-section">
          {/* Connected — what is actually selling. One card of rows: the row
              is the way in, the menu holds the rest. */}
          {connections.length === 0 ? (
            <EmptyState title={t("empty.title")} message={t("empty.body")} />
          ) : (
            <section aria-labelledby="mk-connected">
              <h2 id="mk-connected" className="mb-tight text-base font-semibold tracking-[-0.4px]">{t("connectedTitle")}</h2>
              <ul className="card-surface overflow-hidden">
                {connections.map((c) => {
                  const meta = marketplaceById(c.marketplaceId);
                  const counts = listingCounts(c.id);
                  const perf = performanceOf(c.marketplaceId);
                  const issue = connectionIssue(c);
                  const s = split(EXAMPLE, c.commissionBps);
                  return (
                    <li key={c.id} className="relative flex items-center border-b border-hairline last:border-0 hover:bg-muted-wash">
                      <Link href={`/marketplaces/${c.id}`} className="flex min-h-14 min-w-0 flex-1 flex-col gap-inline py-comfortable pl-card pr-tight">
                        <span className="flex items-center gap-tight">
                          <span className="min-w-0 truncate font-medium">{meta.name}</span>
                          <StatusPill tone={c.status === "connected" ? "success" : c.status === "attention" ? "warning" : "info"}>
                            {t(`status.${c.status}`)}
                          </StatusPill>
                        </span>
                        {/* The money, the way it is decided. Wider screens only:
                            a phone row keeps to the two facts that change. */}
                        <span className="hidden text-[13px] text-muted sm:block">
                          {t("keepOf", { pct: bpsToPct(c.commissionBps), net: formatMoney(s.net), price: formatMoney(s.price) })}
                        </span>
                        <span className="text-[13px] text-muted">
                          {t("listingLine", { live: counts.live, total: Object.values(counts).reduce((a, b) => a + b, 0) })}
                          {/* What it earned is a second line on a phone's row only
                              when it fits; from sm it follows on the same line. */}
                          {perf.orders > 0 && <span className="hidden sm:inline"> · {t("broughtIn", { orders: perf.orders, net: formatMoney(perf.net) })}</span>}
                        </span>
                        {issue && <span className="text-[13px] text-warning">{issue}</span>}
                      </Link>
                      <span className="shrink-0 pr-card">
                        <ActionMenu
                          label={t("rowActions", { name: meta.name })}
                          items={[
                            { key: "open", label: t("manage"), onSelect: () => router.push(`/marketplaces/${c.id}`) },
                            { key: "sync", label: syncing === c.id ? t("syncing") : t("sync"), disabled: syncing === c.id, onSelect: () => doSync(c) },
                          ]}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Not connected — what else is out there */}
          {available.length > 0 && (
            <section aria-labelledby="mk-available">
              <h2 id="mk-available" className="mb-tight text-base font-semibold tracking-[-0.4px]">{t("availableTitle")}</h2>
              <ul className="card-surface overflow-hidden">
                {available.map((m) => (
                  <li key={m.id} className="flex items-center gap-tight border-b border-hairline px-card py-comfortable last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="text-[13px] text-muted">
                        {t(`sells.${m.sells}`)} · {t("typically", { pct: bpsToPct(m.typicalBps) })}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setConnecting({ id: m.id, pick: false })}>{t("connectOne")}</Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {connecting && (
        <ConnectDialog
          marketplaceId={connecting.id}
          choices={connecting.pick ? available : undefined}
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

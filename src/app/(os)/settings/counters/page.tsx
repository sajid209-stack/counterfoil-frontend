"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Store } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listDevices, listLocations, listPaymentAccounts, updateCounter, type Counter } from "@/lib/api";
import { IconTile, RecordList, RecordRow, SectionSkeleton, Switch } from "../_components/SettingsKit";
import { METHODS, METHOD_KEY, NEEDS_ACCOUNT } from "./_lib/methods";

type Tab = "all" | "open" | "closed";
const TABS: Tab[] = ["all", "open", "closed"];

/**
 * Counters, grouped by the location they belong to.
 *
 * The table's columns read "Bookings: 1 selected · Payments: 3" — counts that
 * name nothing — beside a location column repeated down every row and a
 * location filter to undo the repetition. A counter only exists at one place,
 * so the list is drawn under its places, and each row says in words how
 * customers pay there and what it sells.
 *
 * Opening or closing a till was three screens deep: open the counter, scroll to
 * Status, confirm. It is the commonest thing done to a counter, so each row now
 * carries the switch itself. It takes effect the moment it is pressed, and the
 * confirmation offers Undo rather than asking first — closing a till is easy to
 * put back, and a question on every tap trains people to click through
 * questions.
 */
export default function CountersPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  // The counter as last written from this list, so a switch shows its new state
  // at once rather than the list reloading under the finger that pressed it.
  const [latest, setLatest] = useState<Record<string, Counter>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);
  const accountsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);

  const counters = (countersQ.data?.data ?? []).map((c) => latest[c.id] ?? c).filter((c) => c.status !== "archived");
  const devices = devicesQ.data?.data ?? [];
  const liveAccount = (accountsQ.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled);
  const places = [...(locationsQ.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const loading = !countersQ.data || !locationsQ.data || !devicesQ.data || !accountsQ.data;

  const counts: Record<Tab, number> = {
    all: counters.length,
    open: counters.filter((c) => c.status === "active").length,
    closed: counters.filter((c) => c.status === "inactive").length,
  };
  const inTab = (c: Counter) => tab === "all" || (tab === "open" ? c.status === "active" : c.status === "inactive");

  const methodsLine = (c: Counter): { text: string; warn: boolean } => {
    if (c.allowedPaymentMethods.length === 0) return { text: t("counters.noMethods"), warn: true };
    const names = METHODS.filter((m) => c.allowedPaymentMethods.includes(m)).map((m) => t(`counters.method${METHOD_KEY[m]}`));
    const unbacked = !liveAccount && c.allowedPaymentMethods.some((m) => NEEDS_ACCOUNT.has(m));
    return { text: unbacked ? `${names.join(", ")} · ${t("counters.cashOnlyNow")}` : names.join(", "), warn: unbacked };
  };

  const setOpen = async (c: Counter, open: boolean, undoable = true) => {
    setBusy(c.id);
    const res = await updateCounter(c.id, { status: open ? "active" : "inactive" });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest((m) => ({ ...m, [c.id]: res.data }));
    if (!undoable) return;
    toast.success(open ? t("counters.started", { name: c.name }) : t("counters.stopped", { name: c.name }), {
      label: t("common.undo"),
      run: () => setOpen(res.data, !open, false),
    });
  };

  const visible = counters.filter(inTab);

  return (
    <PageShell
      title={t("counters.title")}
      description={t("counters.description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/counters/new")}>
          {t("counters.add")}
        </Button>
      }
    >
      {loading ? (
        <SectionSkeleton />
      ) : counters.length === 0 ? (
        <div className="max-w-3xl">
          <EmptyState
            title={t("counters.emptyTitle")}
            message={t("counters.emptyMessage")}
            action={<Button onClick={() => router.push("/settings/counters/new")}>{t("counters.add")}</Button>}
          />
        </div>
      ) : (
        <div className="flex max-w-4xl flex-col gap-section pb-hero">
          <Tabs
            items={TABS.map((v) => ({ value: v, label: t(`counters.tab.${v}`), count: counts[v] }))}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          {visible.length === 0 ? (
            <p className="py-section text-sm text-muted">{t("counters.emptyTab")}</p>
          ) : (
            <div className="flex flex-col gap-major">
              {places.map((l) => {
                const here = visible.filter((c) => c.locationId === l.id).sort((a, b) => a.name.localeCompare(b.name));
                if (here.length === 0) return null;
                const headingId = `counters-at-${l.id}`;
                return (
                  <section key={l.id} aria-labelledby={headingId} className="flex flex-col gap-tight">
                    <div className="flex flex-wrap items-center gap-tight">
                      <h2 id={headingId} className="text-base font-semibold text-fg">
                        {l.name}
                      </h2>
                      {l.status !== "active" && <StatusPill status={l.status} />}
                    </div>
                    <RecordList label={l.name}>
                      {here.map((c) => {
                        const line = methodsLine(c);
                        const deviceCount = devices.filter((d) => d.counterId === c.id && d.status !== "archived").length;
                        const open = c.status === "active";
                        return (
                          <RecordRow
                            key={c.id}
                            href={`/settings/counters/${c.id}`}
                            leading={<IconTile icon={Store} />}
                            title={c.name}
                            badges={open ? null : <StatusPill tone="neutral">{t("counters.closedTag")}</StatusPill>}
                            meta={
                              <>
                                <span className={cn("block", line.warn ? "text-warning" : undefined)}>{line.text}</span>
                                <span className="block">
                                  {c.allowedProductIds === "all"
                                    ? t("counters.sellsAll")
                                    : t("counters.sellsSome", { count: c.allowedProductIds.length })}
                                  {" · "}
                                  {t("counters.devicesCount", { count: deviceCount })}
                                </span>
                              </>
                            }
                            control={
                              <Switch
                                checked={open}
                                disabled={busy === c.id}
                                onChange={(on) => setOpen(c, on)}
                                label={t("counters.openSwitch", { name: c.name })}
                              />
                            }
                          />
                        );
                      })}
                    </RecordList>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

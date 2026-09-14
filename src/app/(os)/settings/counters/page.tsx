"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Store } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listDevices, listLocations, listPaymentAccounts, type Counter } from "@/lib/api";
import { IconTile, RecordList, RecordRow, SectionSkeleton } from "../_components/SettingsKit";
import { METHODS, METHOD_KEY, NEEDS_ACCOUNT } from "./_lib/methods";

/**
 * Counters, grouped by the location they belong to.
 *
 * The table's columns read "Bookings: 1 selected · Payments: 3" — counts that
 * name nothing — beside a location column repeated down every row and a
 * location filter to undo the repetition. A counter only exists at one place,
 * so the list is drawn under its places, and each row says in words how
 * customers pay there and what it sells. A till that takes card or wallet
 * payments with no live account says so in warning, since those buttons will
 * not work.
 */
export default function CountersPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);
  const accountsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);

  const counters = countersQ.data?.data ?? [];
  const devices = devicesQ.data?.data ?? [];
  const liveAccount = (accountsQ.data?.data ?? []).some((a) => a.status === "active" && a.chargesEnabled);
  const places = [...(locationsQ.data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const loading = countersQ.loading || locationsQ.loading || devicesQ.loading || accountsQ.loading;

  const methodsLine = (c: Counter): { text: string; warn: boolean } => {
    if (c.allowedPaymentMethods.length === 0) return { text: t("counters.noMethods"), warn: true };
    const names = METHODS.filter((m) => c.allowedPaymentMethods.includes(m)).map((m) => t(`counters.method${METHOD_KEY[m]}`));
    const unbacked = !liveAccount && c.allowedPaymentMethods.some((m) => NEEDS_ACCOUNT.has(m));
    return { text: unbacked ? `${names.join(", ")} · ${t("counters.cashOnlyNow")}` : names.join(", "), warn: unbacked };
  };

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
        <div className="flex max-w-4xl flex-col gap-wide pb-hero">
          {places.map((l) => {
            const here = counters.filter((c) => c.locationId === l.id).sort((a, b) => a.name.localeCompare(b.name));
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
                    return (
                      <RecordRow
                        key={c.id}
                        href={`/settings/counters/${c.id}`}
                        leading={<IconTile icon={Store} />}
                        title={c.name}
                        badges={c.status !== "active" ? <StatusPill status={c.status} /> : null}
                        meta={
                          <>
                            <span className={cn("block", line.warn ? "text-warning" : undefined)}>{line.text}</span>
                            <span className="block">
                              {c.allowedProductIds === "all"
                                ? t("counters.sellsAll")
                                : t("counters.sellsSome", { count: c.allowedProductIds.length })}
                            </span>
                          </>
                        }
                        aside={t("counters.devicesCount", { count: deviceCount })}
                      />
                    );
                  })}
                </RecordList>
              </section>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

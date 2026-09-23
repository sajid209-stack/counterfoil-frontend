"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, PackagePlus, ScanLine, TriangleAlert } from "lucide-react";
import {
  ActionMenu,
  Button,
  PageShell,
  StatusPill,
  Tabs,
  useToast,
  type ActionMenuItem,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { formatDate, formatMoney } from "@/lib/format";
import {
  archiveInventoryItem,
  getInventoryItem,
  levelsOf,
  listLocations,
  listStaff,
  movementsOf,
  outOnLoan,
  restoreInventoryItem,
  type StockMovement,
} from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { ItemForm } from "../_components/ItemForm";
import { StockDialog, type StockAction } from "../_components/StockDialog";

/* Who is signed in, from the module that exists so screens stop keeping
   their own copy of a name the real session will replace. */
const actorName = (staff: { id: string; name: string }[]) =>
  staff.find((x) => x.id === DEMO_STAFF_ID)?.name ?? "Counter";

/**
 * One item: what it is, where it is, and everything that has happened to it.
 *
 * The facts lead, before any control. A settings record learned this the hard
 * way — label-left/control-right is the shape of a decision and the wrong shape
 * for a fact, so a page built entirely of controls could only state the count
 * inside the description of a button. Here the three figures and the ledger are
 * the page, and the form is a tab.
 */
export default function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("inventory");
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<"stock" | "details" | "sold">("stock");
  const [stamp, setStamp] = useState(0);
  const [dialog, setDialog] = useState<StockAction | null>(null);

  const itemQ = useApiQuery(() => getInventoryItem(id), [id, stamp]);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 50 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const item = itemQ.data;
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  const nameOf = (lid: string) => locations.find((l) => l.id === lid)?.name ?? lid;

  /* `stamp` is the ask-again signal: both of these are derived from the store,
     which a movement changes without changing `item`. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const levels = useMemo(() => (item ? levelsOf(item.id) : []), [item, stamp]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ledger = useMemo(() => (item ? movementsOf(item.id) : []), [item, stamp]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loan = useMemo(() => (item?.returnable ? outOnLoan(item.id) : 0), [item, stamp]);

  const reload = () => {
    setStamp((n) => n + 1);
    itemQ.reload();
  };

  if (!item) {
    return (
      <PageShell title={t("title")} description={t("description")}>
        <p className="text-[13px] text-muted">{itemQ.loading ? t("loading") : t("notFound")}</p>
      </PageShell>
    );
  }

  const actions: ActionMenuItem[] =
    item.status === "archived"
      ? [
          {
            key: "restore",
            label: t("row.restore"),
            onSelect: async () => {
              const res = await restoreInventoryItem(item.id);
              if (res.ok) { toast.success(t("toast.restored", { name: item.name })); reload(); }
            },
          },
        ]
      : [
          ...(item.returnable ? [{ key: "back", label: t("row.back"), onSelect: () => setDialog("back" as const) }] : []),
          { key: "count", label: t("row.count"), onSelect: () => setDialog("count") },
          { key: "remove", label: t("row.remove"), onSelect: () => setDialog("remove") },
          {
            key: "archive",
            label: t("row.archive"),
            separated: true,
            onSelect: async () => {
              const res = await archiveInventoryItem(item.id);
              if (res.ok) { toast.success(t("toast.archived", { name: item.name })); reload(); }
            },
          },
        ];

  /** One row of the ledger. The sign is the fact; the words are the reason. */
  const moveRow = (m: StockMovement) => (
    <li key={m.id} className="flex flex-wrap items-baseline gap-x-tight gap-y-inline border-b border-hairline py-comfortable last:border-0">
      <span className="w-24 shrink-0 text-[13px] font-medium tabular-nums">
        <span className={cn(m.quantity > 0 ? "text-success" : "text-danger")}>
          {m.quantity > 0 ? "+" : "−"}
          {Math.abs(m.quantity)}
        </span>
      </span>
      <span className="w-28 shrink-0 text-[13px]">{t(`move.${m.kind}`)}</span>
      <span className="min-w-0 flex-1 text-[13px] text-muted">
        {/* A sale needs no typed reason — being a sale IS the reason, and
            an em-dash there read as missing data. */}
        {m.reason ?? (m.kind === "sold" ? t("soldAtTill") : m.kind === "returned" ? t("returnedAtDesk") : "—")}
        {locations.length > 1 && ` · ${nameOf(m.locationId)}`}
      </span>
      <span className="shrink-0 text-[12px] text-muted">
        {/* The time as well as the day: a delivery at nine and a write-off
            at five were indistinguishable, and unorderable on screen. */}
        {formatDate(m.at.slice(0, 10))} {m.at.slice(11, 16)} · {m.by}
      </span>
    </li>
  );

  return (
    <PageShell
      title={item.name}
      description={t("itemDescription")}
      actions={
        <span className="flex items-center gap-tight">
          {item.tracked && item.status !== "archived" && (
            <Button icon={<PackagePlus size={16} strokeWidth={1.5} />} onClick={() => setDialog("receive")}>
              {t("row.receive")}
            </Button>
          )}
          <ActionMenu items={actions} label={t("rowActions", { name: item.name })} />
        </span>
      }
    >
      <div className="flex flex-col gap-section">
        <Link
          href="/inventory"
          className="flex min-h-11 w-fit items-center gap-inline text-[13px] font-medium text-muted hover:text-fg md:min-h-0"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          {t("backToList")}
        </Link>

        {/* The facts, before any control: what it is, and what the shelves
            say. An archived item says so here rather than by looking normal. */}
        <section className="card-surface p-card">
          <div className="flex flex-wrap items-center gap-tight">
            <StatusPill tone={item.outOfStock ? "danger" : item.low ? "warning" : "neutral"}>
              {item.outOfStock ? t("badge.out") : item.low ? t("badge.low") : t("badge.fine")}
            </StatusPill>
            <span className="text-[13px] text-muted">
              {[t(`kind.${item.kind}`), item.sku, item.returnable ? t("returnable") : null, !item.tracked ? t("untracked") : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {item.status === "archived" && <StatusPill tone="neutral">{t("badge.archived")}</StatusPill>}
          </div>

          <dl className="mt-section grid gap-section sm:grid-cols-2 xl:grid-cols-4">
            {[
              item.tracked ? { k: "onHand", v: t("countUnit", { count: item.onHand, unit: item.unit }) } : null,
              /* A hire has a second axis that a sale does not: what is out
                 with somebody. Without it "7 pairs" is a different and wrong
                 claim about a bin holding nineteen. */
              item.tracked && item.returnable ? { k: "onLoan", v: t("countUnit", { count: loan, unit: item.unit }) } : null,
              { k: "price", v: formatMoney(item.price) },
              item.cost != null && item.cost > 0 ? { k: "value", v: formatMoney(item.value) } : null,
            ]
              .filter(Boolean)
              .map((f) => (
                <div key={f!.k} className="flex flex-col gap-inline">
                  <dt className="text-[12px] font-medium text-muted">{t(`fact.${f!.k}`)}</dt>
                  <dd className="type-figure text-[22px] font-semibold leading-tight">{f!.v}</dd>
                  <dd className="text-[12px] text-muted">{t(`fact.${f!.k}Note`)}</dd>
                </div>
              ))}
          </dl>
        </section>

        <Tabs
          items={[
            { value: "stock", label: t("tab.stock") },
            { value: "details", label: t("tab.details") },
            { value: "sold", label: t("tab.sold"), count: item.soldWith.length },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />

        {tab === "stock" && (
          <div className="flex flex-col gap-section">
            {item.tracked ? (
              <>
                {levels.length > 1 && (
                  <section className="card-surface p-card">
                    <h2 className="text-base font-semibold tracking-[-0.4px]">{t("byVenue")}</h2>
                    <ul className="mt-comfortable flex flex-col">
                      {levels.map((l) => (
                        <li key={l.locationId} className="flex flex-wrap items-baseline gap-tight border-b border-hairline py-comfortable last:border-0">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{nameOf(l.locationId)}</span>
                          <span className="text-[13px] tabular-nums">{t("countUnit", { count: l.onHand, unit: item.unit })}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="card-surface p-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-tight">
                    <h2 className="text-base font-semibold tracking-[-0.4px]">{t("ledger")}</h2>
                    <p className="text-[12px] text-muted">{t("ledgerNote")}</p>
                  </div>
                  {ledger.length === 0 ? (
                    <p className="mt-comfortable text-[13px] text-muted">{t("ledgerEmpty")}</p>
                  ) : (
                    <ul className="mt-comfortable flex flex-col">{ledger.map(moveRow)}</ul>
                  )}
                </section>
              </>
            ) : (
              /* An untracked item has no ledger by definition, and saying so
                 is better than an empty table that looks like a failure. */
              <section className="card-surface flex items-start gap-tight p-card">
                <ScanLine size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                <p className="text-[13px] text-muted">{t("untrackedNote")}</p>
              </section>
            )}
          </div>
        )}

        {tab === "details" && (
          <ItemForm
            item={item}
            locations={locations}
            onSaved={() => {
              toast.success(t("toast.saved", { name: item.name }));
              reload();
            }}
          />
        )}

        {tab === "sold" && (
          <section className="card-surface p-card">
            <h2 className="text-base font-semibold tracking-[-0.4px]">{t("soldWithTitle")}</h2>
            <p className="mt-inline text-[13px] text-muted">{t("soldWithHelp")}</p>
            {item.soldWith.length === 0 ? (
              <div className="mt-section flex items-start gap-tight rounded-sm border border-line bg-subtle px-comfortable py-comfortable">
                <TriangleAlert size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                <p className="min-w-0 text-[13px]">
                  {t("soldWithEmpty")}{" "}
                  <Link href="/catalog" className="font-medium underline underline-offset-2">
                    {t("soldWithEmptyLink")}
                  </Link>
                </p>
              </div>
            ) : (
              <ul className="mt-comfortable flex flex-col">
                {item.soldWith.map((s) => (
                  <li key={`${s.kind}-${s.id}`} className="border-b border-hairline last:border-0">
                    <button
                      type="button"
                      onClick={() => router.push(s.kind === "booking" ? `/catalog/bookings/${s.id}` : `/catalog/events/${s.id}`)}
                      className="flex min-h-11 w-full items-center gap-tight py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</span>
                      <StatusPill tone="neutral">{t(`soldWithKind.${s.kind}`)}</StatusPill>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {dialog && (
          <StockDialog
            item={item}
            action={dialog}
            locations={locations}
            actor={actorName(staffQ.data?.data ?? [])}
            onClose={() => setDialog(null)}
            onDone={(message) => {
              setDialog(null);
              toast.success(message);
              reload();
            }}
          />
        )}
      </div>
    </PageShell>
  );
}

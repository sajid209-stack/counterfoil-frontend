"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getResourceMatrix, getSlots, listProducts, listResources, updateResource, type Product, type Resource } from "@/lib/api";
import { isResourceType, isSlotBased } from "@/lib/schedule";
import { resolveProductPrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";

const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";

/** What a row IS, as opposed to what it says. The label is a price or a
 *  count and cannot be filtered on; this can. */
type RowKind = "open" | "full" | "out";

interface Row {
  time: string;
  label: string;
  state: string; // "OPEN" | "BOOKED" | "FULL" | "12/40"
  full: boolean;
  kind: RowKind;
  product: Product;
  resourceId?: string;
}

const KINDS: RowKind[] = ["open", "full", "out"];

export default function SchedulePage() {
  const router = useRouter();
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const toast = useToast();
  const [date, setDate] = useState(TODAY);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), []);
  const [oos, setOos] = useState<Resource | null>(null); // out-of-service dialog
  const [oosReason, setOosReason] = useState("");
  const [oosSaving, setOosSaving] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of productsQ.data?.data ?? []) {
      if (isResourceType(p.bookingType) && !p.flexibleDurations) {
        for (const r of getResourceMatrix(p, date)) {
          for (const s of r.slots) {
            out.push({ time: s.time, label: `${p.name} — ${r.resource.name}`, state: r.resource.outOfService ? t("stateOut") : s.available ? formatMoney(resolveProductPrice(p, date, s.time, p.tiers[0]?.price ?? 0)) : t("stateBooked"), full: !s.available, kind: r.resource.outOfService ? "out" : s.available ? "open" : "full", product: p, resourceId: r.resource.id });
          }
        }
      } else if (isSlotBased(p.bookingType)) {
        for (const s of getSlots(p, date)) {
          out.push({ time: s.time, label: p.name, state: s.remaining <= 0 ? t("stateFull") : `${s.sold}/${s.capacity}`, full: s.remaining <= 0, kind: s.remaining <= 0 ? "full" : "open", product: p });
        }
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }, [productsQ.data, date, t]);

  // A day at a busy turf is a hundred rows. The two questions worth asking of
  // it at the counter are "which one" and "what is still sellable", so those
  // are the two controls — kinds as chips because there are three of them and
  // a cashier is tapping, the booking as a select because the list is long.
  const [bookingFilter, setBookingFilter] = useState("all");
  const [kinds, setKinds] = useState<RowKind[]>(KINDS);
  const toggleKind = (k: RowKind) =>
    setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const scoped = useMemo(
    () => rows.filter((r) => bookingFilter === "all" || r.product.id === bookingFilter),
    [rows, bookingFilter],
  );
  const shownRows = useMemo(() => scoped.filter((r) => kinds.includes(r.kind)), [scoped, kinds]);
  const kindCounts = useMemo(() => {
    const out = { open: 0, full: 0, out: 0 } as Record<RowKind, number>;
    for (const r of scoped) out[r.kind] += 1;
    return out;
  }, [scoped]);
  /** Only the bookings that actually run on this day — offering one with
   *  nothing on the schedule is the empty-chip mistake in a select. */
  const bookingOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.product.id, r.product.name);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const sell = (p: Product) => {
    sessionStorage.setItem("pos_open_product", p.id);
    router.push("/pos");
  };

  const openOos = (resourceId: string) => {
    const r = resourcesQ.data?.data.find((x) => x.id === resourceId);
    if (!r) return;
    setOos(r);
    setOosReason(r.outOfServiceReason ?? "");
  };

  const saveOos = async (outOfService: boolean) => {
    if (!oos) return;
    setOosSaving(true);
    const res = await updateResource(oos.id, { outOfService, outOfServiceReason: outOfService ? oosReason || null : null });
    setOosSaving(false);
    if (res.ok) {
      toast.success(outOfService ? t("markedOut", { name: oos.name }) : t("backInService", { name: oos.name }));
      setOos(null);
      productsQ.reload();
      resourcesQ.reload();
    } else toast.error(res.error.message);
  };

  const dateBtn = (v: string, label: string) => (
    <button key={v} type="button" onClick={() => setDate(v)} className={`h-12 rounded-sm border px-comfortable text-sm ${date === v ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{label}</button>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-section px-section py-section">
      <div>
        <p className="type-label text-[13px] text-ember">{t("fohLabel")}</p>
        <h1 className="type-h1 mt-tight text-2xl">{t("title")}</h1>
      </div>
      <div className="flex flex-wrap gap-tight">
        {dateBtn(TODAY, t("today"))}
        {dateBtn(TOMORROW, t("tomorrow"))}
        <input aria-label={tc("chooseDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 min-w-0 max-w-full rounded-sm border border-line bg-card px-comfortable text-sm" />
      </div>

      <div className="flex flex-col gap-tight">
        <select
          value={bookingFilter}
          onChange={(e) => setBookingFilter(e.target.value)}
          aria-label={t("filterBooking")}
          className="h-12 w-full rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse"
        >
          <option value="all">{t("allBookings")}</option>
          {bookingOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-tight">
          {KINDS.map((k) => {
            const on = kinds.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(k)}
                className={`flex h-12 items-center gap-tight rounded-sm border px-comfortable text-sm transition-colors duration-quick ${
                  on ? "border-ember bg-ember/10 text-brand-foreground" : "border-line bg-card text-muted"
                }`}
              >
                {t(k === "open" ? "filterOpen" : k === "full" ? "filterFull" : "filterOut")}
                <span className="font-mono text-[12px] opacity-70">{kindCounts[k]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {productsQ.loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : rows.length === 0 ? (
        <EmptyState title={t("noSessionsTitle")} message={t("noSessionsMessage")} />
      ) : shownRows.length === 0 ? (
        <EmptyState title={t("noMatchTitle")} message={t("noMatchMessage")} />
      ) : (
        <div className="overflow-hidden card-surface">
          {shownRows.map((r, i) => (
            <div key={i} className="flex items-center gap-section border-b border-line px-section py-tight last:border-0">
              <span className="w-14 font-mono text-sm">{r.time}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
              <span className={`font-mono text-[12px] ${r.full ? "text-faint" : "text-muted"}`}>{r.state}</span>
              {r.full ? (
                r.product.waitlistEnabled ? <Button size="sm" variant="secondary" onClick={() => sell(r.product)}>{t("waitlist")}</Button> : <span className="w-16 text-right font-mono text-[12px] text-faint">—</span>
              ) : (
                <Button size="sm" onClick={() => sell(r.product)}>{t("sell")}</Button>
              )}
              {r.resourceId && (
                <button type="button" aria-label={t("rowActions")} onClick={() => openOos(r.resourceId!)} className="flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-sm border border-line text-faint active:bg-ember/10">
                  <MoreHorizontal size={15} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!oos}
        onClose={() => setOos(null)}
        title={oos ? (oos.outOfService ? t("oosTitleOut", { name: oos.name }) : t("oosTitleIn", { name: oos.name })) : ""}
        footer={
          oos?.outOfService ? (
            <><Button variant="secondary" onClick={() => setOos(null)}>{t("cancel")}</Button><Button loading={oosSaving} onClick={() => saveOos(false)}>{t("returnToService")}</Button></>
          ) : (
            <><Button variant="secondary" onClick={() => setOos(null)}>{t("cancel")}</Button><Button loading={oosSaving} onClick={() => saveOos(true)}>{t("markOutOfService")}</Button></>
          )
        }
      >
        {oos?.outOfService ? (
          <p className="text-sm text-muted">{oos.outOfServiceReason ? t("currentlyOutReason", { reason: oos.outOfServiceReason }) : t("currentlyOut")}</p>
        ) : (
          <FormField label={t("reasonLabel")} placeholder={t("reasonPlaceholder")} value={oosReason} onChange={(e) => setOosReason(e.target.value)} help={t("reasonHelp")} />
        )}
      </Modal>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Search, UserPlus } from "lucide-react";
import { Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { useEnumLabels } from "@/lib/labels";
import { useApiQuery } from "@/lib/useApi";
import {
  addOrderLines,
  addOrderPayment,
  checkInBooking,
  checkout,
  extendBooking,
  isResourceFreeFor,
  listBookings,
  listOrders,
  listProducts,
  markNoShow,
  type Booking,
  type Order,
  type PaymentMethod,
} from "@/lib/api";
import { toMinutes, toTime } from "@/lib/schedule";
import { formatMoney } from "@/lib/format";

const TODAY = "2026-07-29";
const TOMORROW = "2026-07-30";
const time = (iso: string) => iso.slice(11, 16);
const METHODS: PaymentMethod[] = ["cash", "bkash", "bangla_qr", "card_terminal"];

export default function CheckInPage() {
  const t = useTranslations("checkin");
  const tc = useTranslations("common");
  const enumL = useEnumLabels();
  const toast = useToast();
  const [date, setDate] = useState(TODAY);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const bookingsQ = useApiQuery(() => listBookings({ pageSize: 1000 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 1000 }), []);
  const productName = (id: string) => productsQ.data?.data.find((p) => p.id === id)?.name ?? "—";
  const orderOf = (b: Booking): Order | undefined => ordersQ.data?.data.find((o) => o.id === b.orderId);
  const outstanding = (o?: Order) => (o ? Math.max(0, o.total - o.payments.reduce((s, p) => s + p.amount, 0)) : 0);

  // Counter workflows on an expanded booking.
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const [extraFor, setExtraFor] = useState<Booking | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<Booking | null>(null);
  const [noShowFor, setNoShowFor] = useState<Booking | null>(null);
  const [noShowReason, setNoShowReason] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInProduct, setWalkInProduct] = useState("");
  const [walkInParty, setWalkInParty] = useState(2);
  const [walkInName, setWalkInName] = useState("");

  const reload = () => { bookingsQ.reload(); ordersQ.reload(); };

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const orders = ordersQ.data?.data ?? [];
    const day = (bookingsQ.data?.data ?? []).filter((b) => {
      if (b.status !== "confirmed" || b.slotStart.slice(0, 10) !== date) return false;
      if (!q) return true;
      const o = orders.find((x) => x.id === b.orderId);
      return (
        b.orderId.toLowerCase().includes(q) ||
        (o?.reference.toLowerCase().includes(q) ?? false) ||
        (o?.customerName?.toLowerCase().includes(q) ?? false)
      );
    });
    const map = new Map<string, Booking[]>();
    day.forEach((b) => {
      const key = `${b.productId}|${b.slotStart}`;
      map.set(key, [...(map.get(key) ?? []), b]);
    });
    return [...map.entries()].sort((a, b) => a[0].split("|")[1].localeCompare(b[0].split("|")[1]));
  }, [bookingsQ.data, ordersQ.data, date, search]);

  const checkIn = async (b: Booking, count: number) => {
    setPending(b.id);
    await checkInBooking(b.id, count);
    setPending(null);
    reload();
  };

  // Post-sale extend: one increment, only when the lane is free right behind.
  const extendOf = (b: Booking) => {
    if (!b.resourceId || !b.slotEnd) return null;
    const p = productsQ.data?.data.find((x) => x.id === b.productId);
    const cfg = p?.durationConfig;
    if (!p || !cfg) return null;
    const endTime = b.slotEnd.slice(11, 16);
    const current = toMinutes(endTime) - toMinutes(b.slotStart.slice(11, 16));
    if (current + cfg.incrementMinutes > cfg.maxMinutes) return null;
    return { p, cfg, endTime };
  };

  const extend = async (b: Booking) => {
    const x = extendOf(b);
    if (!x) return;
    if (!isResourceFreeFor(b.resourceId!, b.slotStart.slice(0, 10), x.endTime, x.cfg.incrementMinutes, x.p.bufferMinutes ?? 0)) {
      toast.error(t("bookedAfter"));
      return;
    }
    setPending(b.id);
    const newEnd = `${b.slotStart.slice(0, 10)}T${toTime(toMinutes(x.endTime) + x.cfg.incrementMinutes)}:00+06:00`;
    const res = await extendBooking(b.id, newEnd);
    setPending(null);
    if (res.ok) { toast.success(t("extended", { time: newEnd.slice(11, 16) })); reload(); }
    else toast.error(res.error.message);
  };

  /** How much of the balance is being taken right now. Defaults to all of it,
   *  because that is the common case — but a party settling ৳2,000 as ৳1,200
   *  on one phone and ৳800 on another is just as normal, and each tender is
   *  its own payment on the order rather than one rolled-up figure. */
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const payDue = outstanding(orderOf(payFor ?? ({} as Booking)));
  const payNow = payAmount == null ? payDue : Math.max(0, Math.min(payDue, payAmount));

  const takeBalance = async (method: PaymentMethod) => {
    if (!payFor || payNow <= 0) return;
    const o = orderOf(payFor);
    if (!o) return;
    const res = await addOrderPayment(o.id, method, payNow);
    if (res.ok) {
      const left = outstanding(o) - payNow;
      toast.success(
        left > 0
          ? t("partTaken", { amount: formatMoney(payNow), method: enumL.method(method), left: formatMoney(left) })
          : t("balanceTaken", { amount: formatMoney(payNow), method: enumL.method(method) }),
      );
    }
    // Stay open while money is still owed: the second tender is usually
    // handed over in the same breath as the first.
    if (outstanding(o) - payNow > 0) setPayAmount(null);
    else setPayFor(null);
    reload();
  };

  const addExtra = async (addOnId: string) => {
    if (!extraFor) return;
    const p = productsQ.data?.data.find((x) => x.id === extraFor.productId);
    const a = p?.addOns?.find((x) => x.id === addOnId);
    if (!p || !a) return;
    await addOrderLines(extraFor.orderId, [{ productId: `addon_${a.id}`, productName: a.name, tierName: a.perPerson ? t("perPerson") : t("each"), admits: 0, quantity: 1, unitPrice: a.price }]);
    toast.success(t("extraAdded", { name: a.name }));
    setExtraFor(null);
    reload();
  };

  const upgrade = async (tierId: string) => {
    if (!upgradeFor) return;
    const p = productsQ.data?.data.find((x) => x.id === upgradeFor.productId);
    const o = orderOf(upgradeFor);
    const target = p?.tiers.find((t) => t.id === tierId);
    if (!p || !o || !target) return;
    const currentLine = o.lines.filter((l) => l.productId === p.id && l.unitPrice > 0).sort((a, b) => a.unitPrice - b.unitPrice)[0];
    const diff = target.price - (currentLine?.unitPrice ?? 0);
    if (diff <= 0) { toast.error(t("notAnUpgrade")); return; }
    await addOrderLines(o.id, [{ productId: p.id, productName: p.name, tierId: target.id, tierName: t("upgradeLine", { name: target.name }), admits: 0, quantity: 1, unitPrice: diff }]);
    toast.success(t("upgraded", { name: target.name, amount: formatMoney(diff) }));
    setUpgradeFor(null);
    reload();
  };

  const recordNoShow = async () => {
    if (!noShowFor) return;
    await markNoShow(noShowFor.id, noShowReason.trim() || undefined);
    toast.success(t("noShowRecorded"));
    setNoShowFor(null); setNoShowReason("");
    reload();
  };

  const addWalkIn = async () => {
    const p = productsQ.data?.data.find((x) => x.id === walkInProduct);
    const tier = p?.tiers.find((t) => t.active);
    if (!p || !tier) return;
    const res = await checkout({
      channel: "counter", locationId: p.locationIds[0] ?? "loc_fort", counterId: null, staffId: null,
      customerName: walkInName.trim() || t("walkInDefaultName"),
      lines: [{ productId: p.id, productName: p.name, tierId: tier.id, tierName: tier.name, admits: tier.admits ?? 1, quantity: walkInParty, unitPrice: tier.price }],
      bookings: [{ productId: p.id, slotStart: `${date}T12:00:00+06:00`, partySize: walkInParty }],
      taxPct: 0, method: "cash", amountTendered: tier.price * walkInParty,
    });
    if (res.ok) { toast.success(t("walkInSold", { code: res.data.firstTicketCode })); setWalkInOpen(false); setWalkInName(""); setWalkInParty(2); reload(); }
    else toast.error(res.error.message);
  };

  const dateBtn = (v: string, label: string) => (
    <button key={v} type="button" onClick={() => setDate(v)} className={`h-11 md:h-10 rounded-sm border px-comfortable text-sm ${date === v ? "border-inverse bg-inverse text-inverse-fg" : "border-line bg-card"}`}>{label}</button>
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-section px-section py-section">
      <div className="flex items-end justify-between gap-tight">
        <div>
          <p className="type-label text-[13px] text-brand-foreground">{t("gateLabel")}</p>
          <h1 className="type-h1 mt-tight text-2xl">{t("title")}</h1>
        </div>
        <Button variant="secondary" icon={<UserPlus size={16} strokeWidth={1.5} />} onClick={() => { setWalkInProduct(productsQ.data?.data.find((p) => p.bookingType === "BT-01" && p.status === "active")?.id ?? ""); setWalkInOpen(true); }}>
          {t("addWalkIn")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-tight">
        {dateBtn(TODAY, t("today"))}{dateBtn(TOMORROW, t("tomorrow"))}
        <input aria-label={tc("chooseDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 md:h-10 rounded-sm border border-line bg-card px-comfortable text-sm" />
        <div className="flex h-11 min-w-40 md:h-10 flex-1 items-center gap-tight rounded-sm border border-line bg-card px-comfortable focus-within:border-inverse">
          <Search size={15} strokeWidth={1.5} className="shrink-0 text-faint" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="h-full w-full bg-transparent text-sm outline-none" />
        </div>
      </div>

      {bookingsQ.loading ? (
        <div aria-busy="true" className="flex animate-pulse flex-col gap-tight"><div className="h-4 w-1/3 rounded-xs bg-line" /><div className="h-4 w-2/3 rounded-xs bg-line" /><div className="h-4 w-1/2 rounded-xs bg-line" /></div>
      ) : groups.length === 0 ? (
        <EmptyState title={t("noBookingsTitle")} message={search ? t("noBookingsSearch") : t("noBookingsDay")} />
      ) : (
        <div className="flex flex-col gap-tight">
          {groups.map(([key, items]) => {
            const expected = items.reduce((s, b) => s + b.partySize, 0);
            const inCount = items.reduce((s, b) => s + (b.checkedIn ?? 0), 0);
            const [pid, iso] = key.split("|");
            const isOpen = open[key];
            return (
              <div key={key} className="card-surface">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} className="flex w-full items-center gap-section p-comfortable text-left">
                  {isOpen ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
                  <span className="w-14 font-mono text-sm">{time(iso)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{productName(pid)}</span>
                  <span className={`font-mono text-[13px] ${inCount >= expected ? "text-success" : "text-muted"}`}>{inCount}/{expected}</span>
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-tight border-t border-line p-comfortable">
                    {items.map((b) => {
                      const o = orderOf(b);
                      const due = outstanding(o);
                      const done = (b.checkedIn ?? 0) >= b.partySize;
                      const p = productsQ.data?.data.find((x) => x.id === b.productId);
                      return (
                        <div key={b.id} className="rounded-sm border border-line p-tight">
                          <div className="flex items-center gap-tight text-sm">
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">{o?.reference ?? b.orderId}{o?.customerName ? ` · ${o.customerName}` : ""} · {t("party", { size: b.partySize })}</span>
                            {b.noShow ? (
                              <span className="shrink-0 rounded-xs bg-danger/10 px-tight py-inline font-mono text-[12px] text-danger">{b.noShowReason ? t("noShowTagReason", { reason: b.noShowReason }) : t("noShowTag")}</span>
                            ) : (
                              <span className="shrink-0 font-mono text-[12px]">{t("inCount", { done: b.checkedIn ?? 0, total: b.partySize })}</span>
                            )}
                          </div>
                          {/* Paid vs outstanding — the gate opens only on a settled order. */}
                          {o && (
                            <div className="mt-inline flex flex-wrap items-center gap-tight font-mono text-[12px] tabular-nums">
                              <span className="text-muted">{t("paidOf", { paid: formatMoney(o.payments.reduce((s, x) => s + x.amount, 0)), total: formatMoney(o.total) })}</span>
                              {due > 0 ? <span className="rounded-xs bg-brand-600 px-tight text-white">{t("owes", { amount: formatMoney(due) })}</span> : <span className="text-success">{t("settled")}</span>}
                              <span className="min-w-0 truncate text-faint">· {o.payments.map((x) => `${enumL.method(x.method)} ${formatMoney(x.amount)}`).join(" + ")}</span>
                            </div>
                          )}
                          <div className="mt-tight flex flex-wrap gap-tight">
                            {due > 0 && !b.noShow && <Button size="sm" onClick={() => setPayFor(b)}>{t("takeBalanceBtn")}</Button>}
                            {!b.noShow && (p?.addOns?.length ?? 0) > 0 && <Button size="sm" variant="secondary" onClick={() => setExtraFor(b)}>{t("addExtraBtn")}</Button>}
                            {!b.noShow && (p?.tiers.filter((tier) => tier.active).length ?? 0) > 1 && <Button size="sm" variant="secondary" onClick={() => setUpgradeFor(b)}>{t("upgradeBtn")}</Button>}
                            {extendOf(b) && !b.noShow && (
                              <Button size="sm" variant="secondary" loading={pending === b.id} onClick={() => extend(b)}>{t("extendBtn", { minutes: extendOf(b)!.cfg.incrementMinutes })}</Button>
                            )}
                            {!done && !b.noShow && (
                              <>
                                {b.partySize > 1 && (b.checkedIn ?? 0) < b.partySize - 1 && (
                                  <Button size="sm" variant="secondary" disabled={due > 0} loading={pending === b.id} onClick={() => checkIn(b, (b.checkedIn ?? 0) + 1)}>+1</Button>
                                )}
                                <Button size="sm" disabled={due > 0} loading={pending === b.id} onClick={() => checkIn(b, b.partySize)}>{due > 0 ? t("settleFirst") : t("checkInAll")}</Button>
                                {(b.checkedIn ?? 0) === 0 && <Button size="sm" variant="secondary" onClick={() => { setNoShowFor(b); setNoShowReason(""); }}>{t("noShowBtn")}</Button>}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Take the outstanding balance — any configured method works. */}
      <Modal open={!!payFor} onClose={() => { setPayFor(null); setPayAmount(null); }} title={payFor ? t("takeAmount", { amount: formatMoney(payDue) }) : t("takeBalanceTitle")}>
        <div className="mb-section flex flex-col gap-tight">
          <label className="type-label text-[12px] text-muted" htmlFor="ci-amount">{t("amountLabel")}</label>
          <div className="flex items-center gap-tight">
            <input
              id="ci-amount"
              inputMode="decimal"
              value={payAmount == null ? String(payDue / 100) : String(payAmount / 100)}
              onChange={(e) => {
                const n = parseFloat(e.target.value.trim());
                setPayAmount(Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0);
              }}
              className="h-12 min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable text-right font-mono text-sm outline-none focus:border-ember"
            />
            <button type="button" onClick={() => setPayAmount(null)} className="h-12 shrink-0 rounded-sm border border-line px-comfortable text-[13px]">
              {t("amountAll")}
            </button>
          </div>
          {payNow < payDue && payNow > 0 && (
            <p className="text-[12px] text-muted">{t("partRemaining", { left: formatMoney(payDue - payNow) })}</p>
          )}
        </div>
        <p className="mb-section text-[13px] text-muted">{t("receiptNote")}</p>
        <div className="grid grid-cols-2 gap-tight">
          {METHODS.map((m) => <Button key={m} variant="secondary" className="h-12" disabled={payNow <= 0} onClick={() => takeBalance(m)}>{enumL.method(m)}</Button>)}
        </div>
      </Modal>

      <Modal open={!!extraFor} onClose={() => setExtraFor(null)} title={t("addExtraTitle")}>
        <div className="flex flex-col gap-tight">
          {(productsQ.data?.data.find((x) => x.id === extraFor?.productId)?.addOns ?? []).map((a) => (
            <Button key={a.id} variant="secondary" className="justify-between" onClick={() => addExtra(a.id)}>
              <span>{a.name}</span><span className="font-mono tabular-nums">{formatMoney(a.price)}{a.perPerson ? t("perHead") : ""}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!upgradeFor} onClose={() => setUpgradeFor(null)} title={t("upgradeTitle")}>
        <p className="mb-section text-[13px] text-muted">{t("upgradeNote")}</p>
        <div className="flex flex-col gap-tight">
          {(productsQ.data?.data.find((x) => x.id === upgradeFor?.productId)?.tiers.filter((tier) => tier.active) ?? []).map((tier) => (
            <Button key={tier.id} variant="secondary" className="justify-between" onClick={() => upgrade(tier.id)}>
              <span>{tier.name}</span><span className="font-mono tabular-nums">{formatMoney(tier.price)}</span>
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={!!noShowFor} onClose={() => setNoShowFor(null)} title={t("recordNoShowTitle")} footer={<><Button variant="secondary" onClick={() => setNoShowFor(null)}>{t("cancel")}</Button><Button onClick={recordNoShow}>{t("recordNoShowBtn")}</Button></>}>
        <FormField label={t("reasonLabel")} placeholder={t("reasonPlaceholder")} value={noShowReason} onChange={(e) => setNoShowReason(e.target.value)} />
      </Modal>

      <Modal open={walkInOpen} onClose={() => setWalkInOpen(false)} title={t("walkInTitle")} footer={<><Button variant="secondary" onClick={() => setWalkInOpen(false)}>{t("cancel")}</Button><Button disabled={!walkInProduct} onClick={addWalkIn}>{t("sellAndAdd")}</Button></>}>
        <div className="flex flex-col gap-section">
          <FormField label={t("productLabel")} variant="select" value={walkInProduct} onChange={(e) => setWalkInProduct(e.target.value)} options={(productsQ.data?.data ?? []).filter((p) => p.status === "active" && (p.bookingType === "BT-01" || p.bookingType === "BT-06")).map((p) => ({ value: p.id, label: p.name }))} />
          <FormField label={t("nameLabel")} placeholder={t("walkInDefaultName")} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
          <div className="flex items-center justify-between rounded-sm border border-line bg-card p-comfortable">
            <span className="text-sm">{t("partySize")}</span>
            <div className="flex items-center gap-tight">
              <button type="button" aria-label={t("fewer")} onClick={() => setWalkInParty((g) => Math.max(1, g - 1))} className="h-11 w-11 rounded-sm border border-line text-lg">−</button>
              <span className="w-8 text-center font-mono tabular-nums">{walkInParty}</span>
              <button type="button" aria-label={t("more")} onClick={() => setWalkInParty((g) => g + 1)} className="h-11 w-11 rounded-sm border border-line text-lg">+</button>
            </div>
          </div>
          <p className="text-[12px] text-faint">{t("walkInHint")}</p>
        </div>
      </Modal>
    </main>
  );
}

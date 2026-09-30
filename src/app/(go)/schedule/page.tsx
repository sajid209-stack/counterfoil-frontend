"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Lock } from "lucide-react";
import { Button, EmptyState, FormField, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEMO_NOW_MINUTES, DEMO_TODAY, slotISO } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { DEMO_COUNTER_ID, DEMO_STAFF_ID } from "@/lib/session";
import {
  activeHolds,
  checkInBooking,
  listProducts,
  listResources,
  listStaff,
  peekBookings,
  peekCounters,
  peekOrders,
  placeHold,
  releaseHold,
  updateResource,
  type Resource,
} from "@/lib/api";
import { shiftDay } from "@/lib/dayModel";
import type { OpenOption } from "@/app/(os)/calendar/_components/openSlots";
import { buildBoard, dayLoad, toTimeOfDay, type Block, type Column } from "./_lib/board";
import { Board } from "./_components/Board";
import { BlockSheet, SlotSheet, type HoldRequest } from "./_components/Sheets";

type View = "grid" | "list";
type FreePick = { column: Column; block: Extract<Block, { type: "free" | "session" }> };
type BlockPick = { column: Column; block: Extract<Block, { type: "booking" | "hold" }> };

const noopSubscribe = () => () => {};
const KEY = "cf_schedule_";
function remembered(k: string): string | null {
  try {
    return typeof window === "undefined" ? null : sessionStorage.getItem(KEY + k);
  } catch {
    return null;
  }
}
function remember(k: string, v: string) {
  try {
    sessionStorage.setItem(KEY + k, v);
  } catch {
    // The choice still applies for this visit.
  }
}

/** Monday of the week a day is in — the rest of the app reads a week Monday first. */
function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return shiftDay(ymd, -dow);
}

/**
 * The counter's schedule: the day as a board of places and hours, where a
 * free hour is sold or held by tapping it.
 *
 * It is the OS calendar's phone layout — a week strip, then the day — built
 * for a till instead of an office: one venue (the one this counter is at),
 * places as columns so an empty hour has a place to be tapped, and every
 * action ending on the same two buttons in the same two places.
 */
export default function SchedulePage() {
  const router = useRouter();
  const t = useTranslations("schedule");
  const format = useFormatter();
  const toast = useToast();

  /* Where the cashier was — the day, the group, the view — survives a trip to
     the till and back. Sell leaves this screen, and coming back to today's
     courts when you were on Saturday's lanes is how a second sale gets
     rung up on the wrong day. */
  const [date, setDateState] = useState<string>(() => remembered("date") ?? DEMO_TODAY);
  const [view, setViewState] = useState<View>(() => (remembered("view") === "list" ? "list" : "grid"));
  const [groupKey, setGroupState] = useState<string | null>(() => remembered("group"));
  const setDate = (d: string) => { setDateState(d); remember("date", d); };
  const setView = (v: View) => { setViewState(v); remember("view", v); };
  const setGroupKey = (g: string) => { setGroupState(g); remember("group", g); };
  const [freePick, setFreePick] = useState<FreePick | null>(null);
  const [blockPick, setBlockPick] = useState<BlockPick | null>(null);
  const [busy, setBusy] = useState(false);
  /* The mock store is synchronous and the board reads it directly, so a
     change is shown by asking again rather than by refetching. */
  const [version, setVersion] = useState(0);
  const [oos, setOos] = useState<Resource | null>(null);
  const [oosReason, setOosReason] = useState("");
  const [oosSaving, setOosSaving] = useState(false);

  const productsQ = useApiQuery(() => listProducts({ pageSize: 200, filters: { status: "active" } }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), [version]);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);

  const locationId = peekCounters().find((c) => c.id === DEMO_COUNTER_ID)?.locationId ?? "loc_fort";
  const isToday = date === DEMO_TODAY;
  const nowMinutes = isToday ? DEMO_NOW_MINUTES : null;
  const me = (staffQ.data?.data ?? []).find((s) => s.id === DEMO_STAFF_ID)?.name ?? t("sheet.counter");

  const groups = useMemo(
    () =>
      buildBoard({
        products: productsQ.data?.data ?? [],
        resources: resourcesQ.data?.data ?? [],
        bookings: peekBookings(),
        holds: activeHolds(),
        orders: peekOrders(),
        date,
        today: DEMO_TODAY,
        nowMinutes: DEMO_NOW_MINUTES,
        locationId,
        sessionsLabel: t("board.shows"),
        placesLabel: t("board.places"),
      }),
    // `version` is the store's change signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productsQ.data, resourcesQ.data, date, locationId, version, t],
  );
  const group = groups.find((g) => g.key === groupKey) ?? groups[0] ?? null;

  const week = useMemo(() => {
    const mon = mondayOf(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = shiftDay(mon, i);
      return { date: d, load: dayLoad(peekBookings(), d, locationId) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, locationId, version]);

  // ── actions ────────────────────────────────────────────────────────────
  /* Sell opens the till's own sheet, already on this place, this day and
     this time. The till asks the rest (how many people, how long) and then
     Buy now → Complete — the same steps as any other sale. */
  const openTill = (productId: string, time: string, resourceId?: string) => {
    sessionStorage.setItem("pos_open_product", productId);
    sessionStorage.setItem("pos_open_slot", JSON.stringify({ date, time, resourceId }));
    router.push("/pos");
  };

  const sell = (option: OpenOption) => {
    if (!freePick) return;
    const time = freePick.block.type === "free" ? freePick.block.time : freePick.block.time;
    openTill(option.product.id, time, freePick.column.kind === "resource" ? freePick.column.id : undefined);
  };

  const lengthToExpiry = (length: HoldRequest["length"]) =>
    length === "day" ? null : new Date(Date.now() + length * 60000).toISOString();

  const hold = async (option: OpenOption, req: HoldRequest) => {
    if (!freePick) return;
    setBusy(true);
    const { column, block } = freePick;
    const res =
      block.type === "free"
        ? await placeHold({
            productId: option.product.id,
            productName: option.product.name,
            locationId,
            kind: "resource",
            date,
            slotStart: slotISO(date, block.time),
            slotEnd: slotISO(date, toTimeOfDay(block.end)),
            quantity: 1,
            resourceId: column.id,
            resourceName: column.name,
            heldFor: req.heldFor,
            placedBy: me,
            expiresAt: lengthToExpiry(req.length),
          })
        : await placeHold({
            productId: block.product.id,
            productName: block.product.name,
            locationId,
            kind: "capacity",
            date,
            slotStart: slotISO(date, block.time),
            slotEnd: slotISO(date, toTimeOfDay(block.end)),
            quantity: req.quantity,
            heldFor: req.heldFor,
            placedBy: me,
            expiresAt: lengthToExpiry(req.length),
          });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setFreePick(null);
    setVersion((v) => v + 1);
    toast.success(t("toast.held", { name: req.heldFor }), {
      label: t("toast.undo"),
      run: async () => {
        await releaseHold(res.data.id);
        setVersion((v) => v + 1);
      },
    });
  };

  const release = async () => {
    if (!blockPick || blockPick.block.type !== "hold") return;
    const h = blockPick.block.hold;
    setBusy(true);
    await releaseHold(h.id);
    setBusy(false);
    setBlockPick(null);
    setVersion((v) => v + 1);
    toast.success(t("toast.released", { name: h.heldFor }));
  };

  /* The person it was held for is at the counter: the hold goes, and the
     till opens on exactly what was being kept for them. */
  const sellHold = async () => {
    if (!blockPick || blockPick.block.type !== "hold") return;
    const h = blockPick.block.hold;
    await releaseHold(h.id);
    openTill(h.productId, (h.slotStart ?? "").slice(11, 16), h.resourceId ?? undefined);
  };

  const checkIn = async () => {
    if (!blockPick || blockPick.block.type !== "booking") return;
    const b = blockPick.block.booking;
    setBusy(true);
    const res = await checkInBooking(b.id, b.partySize);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setBlockPick(null);
    setVersion((v) => v + 1);
    toast.success(t("toast.checkedIn", { name: blockPick.block.guest ?? t("board.walkIn") }));
  };

  const saveOos = async (outOfService: boolean) => {
    if (!oos) return;
    setOosSaving(true);
    const res = await updateResource(oos.id, { outOfService, outOfServiceReason: outOfService ? oosReason || null : null });
    setOosSaving(false);
    if (res.ok) {
      toast.success(outOfService ? t("markedOut", { name: oos.name }) : t("backInService", { name: oos.name }));
      setOos(null);
      setVersion((v) => v + 1);
      productsQ.reload();
    } else toast.error(res.error.message);
  };

  // ── what the sheets are about ─────────────────────────────────────────
  const freeTitle = freePick ? (freePick.column.kind === "session" ? freePick.column.name : freePick.column.name) : "";
  const freeWhen = freePick
    ? `${toTimeOfDay(freePick.block.start)}–${toTimeOfDay(freePick.block.end)} · ${format.dateTime(new Date(`${date}T12:00:00`), { weekday: "short", day: "numeric", month: "short" })}`
    : "";
  const freeOptions: OpenOption[] = freePick
    ? freePick.block.type === "free"
      ? freePick.block.options
      : [
          {
            key: freePick.block.key,
            product: freePick.block.product,
            kind: "session",
            date,
            time: freePick.block.time,
            price: freePick.block.price,
            remaining: freePick.block.remaining,
            capacity: freePick.block.capacity,
          },
        ]
    : [];

  const listItems = useMemo(() => {
    const out: { column: Column; block: Extract<Block, { type: "booking" | "hold" }> }[] = [];
    for (const g of groups)
      for (const c of g.columns)
        for (const b of g.blocks.get(c.id) ?? []) if (b.type === "booking" || b.type === "hold") out.push({ column: c, block: b });
    return out.sort((a, b) => a.block.start - b.block.start);
  }, [groups]);

  /* The server cannot see what this browser remembered, so nothing that
     depends on it is drawn until the browser has taken over — otherwise the
     first paint and the hydrated one disagree about the day. */
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const loading = !hydrated || productsQ.loading || resourcesQ.loading;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-section px-gutter pb-40 pt-section">
      <h1 className="sr-only">{t("title")}</h1>

      {/* ── the week, with how busy each day is ── */}
      <section className="go-surface flex flex-col gap-tight rounded-go p-tight">
        <div className="flex items-center justify-between gap-tight px-inline">
          <button type="button" onClick={() => setDate(shiftDay(date, -7))} aria-label={t("prevWeek")} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted-wash">
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <p className="text-[0.9375rem] font-semibold text-fg">
            {format.dateTime(new Date(`${date}T12:00:00`), { month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-inline">
            {!isToday && (
              <button type="button" onClick={() => setDate(DEMO_TODAY)} className="inline-flex h-11 items-center rounded-full border-2 border-line px-comfortable text-[0.875rem] font-semibold text-fg">
                {t("today")}
              </button>
            )}
            <button type="button" onClick={() => setDate(shiftDay(date, 7))} aria-label={t("nextWeek")} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted-wash">
              <ChevronRight size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {week.map((d) => {
            const on = d.date === date;
            const today = d.date === DEMO_TODAY;
            const dt = new Date(`${d.date}T12:00:00`);
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setDate(d.date)}
                aria-pressed={on}
                aria-label={format.dateTime(dt, { weekday: "long", day: "numeric", month: "long" })}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-go-sm transition-colors duration-quick",
                  on ? "bg-ember-solid text-white" : today ? "ring-2 ring-inset ring-ember-solid text-fg" : "text-fg hover:bg-muted-wash",
                )}
              >
                <span className={cn("text-[0.8125rem] font-medium", on ? "text-white" : "text-muted")}>
                  {format.dateTime(dt, { weekday: "narrow" })}
                </span>
                <span className="text-[1.125rem] font-semibold tabular-nums leading-none">{dt.getDate()}</span>
                <span aria-hidden className="flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(3, d.load) }, (_, i) => (
                    <span key={i} className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-white" : "bg-ember")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── what to show, and how ── */}
      <div className="flex flex-wrap items-center justify-between gap-tight">
        <div role="tablist" aria-label={t("board.whatLabel")} className="flex flex-wrap gap-tight">
          {groups.map((g) => {
            const on = g.key === group?.key;
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => { setGroupKey(g.key); setView("grid"); }}
                className={cn(
                  "inline-flex h-11 items-center gap-inline rounded-full border-2 px-comfortable text-[0.9375rem] font-semibold transition-colors duration-quick",
                  on && view === "grid" ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg",
                )}
              >
                {g.label}
                <span className={cn("rounded-full px-1.5 text-[0.8125rem] tabular-nums", on && view === "grid" ? "bg-white/25" : "bg-subtle text-muted")}>
                  {g.freeCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="-mt-tight flex items-center justify-between gap-tight">
        <p className="min-w-0 text-[0.875rem] text-muted">
          {view === "grid" && group ? t("board.freeLine", { count: group.freeCount }) : t("board.listLine", { count: listItems.length })}
        </p>
        <div role="radiogroup" aria-label={t("board.viewLabel")} className="inline-flex rounded-full border-2 border-line bg-card p-0.5">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn(
                "inline-flex h-10 items-center gap-inline rounded-full px-comfortable text-[0.875rem] font-semibold",
                view === v ? "bg-fg text-surface" : "text-muted",
              )}
            >
              {v === "grid" ? <LayoutGrid size={16} aria-hidden /> : <List size={16} aria-hidden />}
              {t(v === "grid" ? "board.viewGrid" : "board.viewList")}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="go-surface h-[60dvh] animate-pulse rounded-go" />
      ) : !group ? (
        <EmptyState title={t("board.emptyTitle")} message={t("board.emptyMessage")} />
      ) : view === "grid" ? (
        <>
          <Board
            group={group}
            nowMinutes={nowMinutes}
            onFree={(column, block) => setFreePick({ column, block })}
            onSession={(column, block) => block.remaining > 0 && setFreePick({ column, block })}
            onBooking={(column, block) => setBlockPick({ column, block })}
            onHold={(column, block) => setBlockPick({ column, block })}
            onColumn={(c) => { if (c.resource) { setOos(c.resource); setOosReason(c.resource.outOfServiceReason ?? ""); } }}
          />
          {/* The key, drawn with the same shapes the board uses. */}
          <ul aria-label={t("board.keyLabel")} className="flex flex-wrap gap-x-section gap-y-tight text-[0.875rem] text-muted">
            <li className="flex items-center gap-inline"><span aria-hidden className="flex h-5 w-5 items-center justify-center rounded border border-line bg-card font-bold text-ember">+</span>{t("board.keyFree")}</li>
            <li className="flex items-center gap-inline"><span aria-hidden className="h-5 w-5 rounded border-l-[3px] border-l-ember-solid bg-ember/15" />{t("board.keyBooked")}</li>
            <li className="flex items-center gap-inline"><span aria-hidden className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-strong"><Lock size={11} /></span>{t("board.onHold")}</li>
            <li className="flex items-center gap-inline"><span aria-hidden className="h-5 w-5 rounded bg-subtle ring-1 ring-inset ring-line" />{t("board.keyClosed")}</li>
          </ul>
        </>
      ) : listItems.length === 0 ? (
        <EmptyState title={t("board.listEmptyTitle")} message={t("board.listEmptyMessage")} />
      ) : (
        <ul className="go-surface divide-y divide-hairline overflow-hidden rounded-go">
          {listItems.map(({ column, block }) => {
            const isHold = block.type === "hold";
            const who = isHold ? block.hold.heldFor : (block.guest ?? t("board.walkIn"));
            const what = isHold ? block.hold.productName : (block.product?.name ?? "");
            const place = column.kind === "unassigned" ? t("board.noPlace") : column.name;
            return (
              <li key={block.key}>
                <button
                  type="button"
                  onClick={() => setBlockPick({ column, block })}
                  className="flex min-h-16 w-full items-center gap-comfortable px-card py-tight text-left hover:bg-muted-wash"
                >
                  <span className="w-12 shrink-0 text-[0.9375rem] font-semibold tabular-nums text-fg">{toTimeOfDay(block.start)}</span>
                  <span
                    aria-hidden
                    className={cn("h-10 w-1 shrink-0 rounded-full", isHold ? "bg-strong" : block.type === "booking" && block.arrived ? "bg-success" : "bg-ember-solid")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[0.9375rem] font-semibold text-fg">
                      {isHold && <Lock size={14} className="shrink-0 text-muted" aria-hidden />}
                      <span className="truncate">{who}</span>
                    </span>
                    <span className="block truncate text-[0.875rem] text-muted">{[what, place].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {freePick && (
        <SlotSheet
          key={freePick.block.key}
          open
          onClose={() => setFreePick(null)}
          title={freeTitle}
          when={freeWhen}
          options={freeOptions}
          isSession={freePick.block.type === "session"}
          maxHold={freePick.block.type === "session" ? freePick.block.remaining : 1}
          onSell={sell}
          onHold={hold}
          busy={busy}
        />
      )}

      <BlockSheet
        open={!!blockPick}
        onClose={() => setBlockPick(null)}
        column={blockPick?.column ?? null}
        block={blockPick?.block ?? null}
        isToday={isToday}
        onCheckIn={checkIn}
        onRelease={release}
        onSellHold={sellHold}
        busy={busy}
      />

      <Modal
        open={!!oos}
        onClose={() => setOos(null)}
        title={oos ? (oos.outOfService ? t("oosTitleOut", { name: oos.name }) : t("oosTitleIn", { name: oos.name })) : ""}
        footer={
          <>
            <Button shape="pill" variant="secondary" onClick={() => setOos(null)}>
              {t("cancel")}
            </Button>
            <Button shape="pill" loading={oosSaving} onClick={() => saveOos(!oos?.outOfService)}>
              {oos?.outOfService ? t("returnToService") : t("markOutOfService")}
            </Button>
          </>
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

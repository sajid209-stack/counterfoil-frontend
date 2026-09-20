"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronUp, SlidersHorizontal, Tag, Wrench } from "lucide-react";
import { ActionMenu, Button, DateField, EmptyState, FormField, Modal, useToast, type ActionMenuItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEMO_NOW_MINUTES, DEMO_TODAY, demoDay, sessionPressure } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { listProducts, updateResource, type Product, type Resource } from "@/lib/api";
import { formatPriceShort } from "@/lib/format";
import { buildDay, groupByTime, shiftDay, type DaySlot, type Lane } from "./_lib/day";

/* The app's one date, not a private copy of it — the token's own doc
   comment warns that two components each holding their own is how a hold
   lands in a different month from the schedule it blocks. */
const TODAY = DEMO_TODAY;
const TOMORROW = demoDay(1);

type Status = "all" | "open" | "full";
const STATUSES: Status[] = ["all", "open", "full"];
type T = ReturnType<typeof useTranslations<"schedule">>;

export default function SchedulePage() {
  const router = useRouter();
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const format = useFormatter();
  const toast = useToast();
  const [date, setDate] = useState(TODAY);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);

  const [status, setStatus] = useState<Status>("all");
  const [bookingFilter, setBookingFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [chooser, setChooser] = useState<DaySlot | null>(null);
  const [oos, setOos] = useState<Resource | null>(null);
  const [oosReason, setOosReason] = useState("");
  const [oosSaving, setOosSaving] = useState(false);

  const day = useMemo(() => buildDay(productsQ.data?.data ?? [], date), [productsQ.data, date]);

  /* Only the bookings that actually run on this day — offering one with
     nothing on the schedule is the empty-chip mistake in a select. */
  const bookingOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of day.slots) for (const p of s.lane.products) seen.set(p.id, p.name);
    for (const l of day.lanes) for (const p of l.products) seen.set(p.id, p.name);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [day]);

  /* Choosing one booking scopes every row to it: a field it cannot use drops
     out, and a field it could take but that is taken for THIS booking reads
     Booked even where another booking could still have the hour. Filtering
     the list without also filtering the price would state a figure the sale
     would not charge. */
  const scoped = useMemo<DaySlot[]>(() => {
    if (bookingFilter === "all") return day.slots;
    return day.slots
      .filter((s) => s.lane.products.some((p) => p.id === bookingFilter))
      .map((s) => {
        const options = s.options.filter((o) => o.product.id === bookingFilter);
        return { ...s, options, kind: options.length ? ("open" as const) : ("full" as const), price: options[0]?.price ?? s.price };
      });
  }, [day.slots, bookingFilter]);

  const counts = useMemo(() => {
    let open = 0;
    for (const s of scoped) if (s.kind === "open") open += 1;
    return { all: scoped.length, open, full: scoped.length - open };
  }, [scoped]);

  const shown = useMemo(() => (status === "all" ? scoped : scoped.filter((s) => s.kind === status)), [scoped, status]);

  /* A day only has a "now" while it IS today. On any other date the list
     opens on the whole day, because all of it is still ahead. */
  const now = date === TODAY ? DEMO_NOW_MINUTES : null;
  const groups = useMemo(() => groupByTime(shown), [shown]);
  const pastGroups = now === null ? [] : groups.filter((g) => g.minutes < now);
  const visibleGroups = showEarlier || now === null ? groups : groups.filter((g) => g.minutes >= now);

  /* What the counter can sell this minute, and when it can next. Read off the
     same rows the list draws, so the rail and the day cannot disagree. */
  const liveNow = useMemo(() => {
    if (now === null) return null;
    const free = scoped.filter((s) => s.kind === "open");
    /* A field is free NOW while the slot around now is still free. A session
       is not: a departure that has already left cannot be sold, so what the
       counter wants of it is the next one — the same distinction
       `posLiveState` makes on the sell wall. */
    return {
      onNow: free.filter((s) => !s.lane.isSession && s.minutes <= now && now < s.minutes + s.spanMinutes),
      next: free.find((s) => s.minutes >= now) ?? null,
    };
  }, [scoped, now]);

  /* The till opens on the slot that was tapped, not on the product's own
     default day. The date travels too, so tomorrow's 19:00 sells as tomorrow's
     19:00 rather than silently as today's. */
  const sell = (p: Product, slot?: DaySlot) => {
    sessionStorage.setItem("pos_open_product", p.id);
    if (slot) sessionStorage.setItem("pos_open_slot", JSON.stringify({ date, time: slot.time, resourceId: slot.lane.resource?.id }));
    else sessionStorage.removeItem("pos_open_slot");
    router.push("/pos");
  };
  const take = (slot: DaySlot) => {
    if (slot.options.length > 1) setChooser(slot);
    else if (slot.options[0]) sell(slot.options[0].product, slot);
  };

  const openOos = (lane: Lane) => {
    if (!lane.resource) return;
    setOos(lane.resource);
    setOosReason(lane.resource.outOfServiceReason ?? "");
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
    } else toast.error(res.error.message);
  };

  /* The picker beside it already reads "29 Jul 2026", so this line says the
     part a picker cannot: which day of the week, and whether it is today. */
  const weekday = format.dateTime(new Date(`${date}T12:00:00`), { weekday: "long" });
  const dayLabel = date === TODAY ? `${t("today")} · ${weekday}` : date === TOMORROW ? `${t("tomorrow")} · ${weekday}` : weekday;

  const filterSummary = [
    bookingFilter === "all" ? null : bookingOptions.find((o) => o.id === bookingFilter)?.name,
    status === "all" ? null : t(status === "open" ? "filterOpen" : "filterFull"),
  ]
    .filter(Boolean)
    .join(" · ");

  const step = (n: number) => setDate((d) => shiftDay(d, n));

  return (
    <main className="mx-auto w-full max-w-6xl px-section py-section">
      <div className="flex flex-col gap-section lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-section">
        <div className="flex min-w-0 flex-col gap-section">
          {/* Title and the day on one row. The screen used to spend an eyebrow,
              a title and three separate date controls — 341px of a 390px
              phone — before the first row of the schedule appeared. */}
          <div className="flex flex-wrap items-center justify-between gap-tight">
            <div className="min-w-0">
              <h1 className="type-h1 text-xl">{t("title")}</h1>
              <p className="text-[13px] text-muted">{dayLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-tight">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t("prevDay")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-muted active:bg-ember/10"
              >
                <ChevronLeft size={18} strokeWidth={1.5} />
              </button>
              <DateField
                value={date}
                today={TODAY}
                onChange={setDate}
                shape="go"
                labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
                className="w-[150px]"
              />
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t("nextDay")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-muted active:bg-ember/10"
              >
                <ChevronRight size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Filters fold on a phone, as the OS calendar's already do: three
              controls kept open cost more of the screen than the first four
              rows of the day they are there to narrow. */}
          <div className="flex flex-col gap-tight">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="flex h-11 items-center gap-tight rounded-full border border-line bg-card px-comfortable text-sm sm:hidden"
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left">{filterSummary || t("filters")}</span>
              <ChevronRight
                size={16}
                strokeWidth={1.5}
                aria-hidden
                className={cn("shrink-0 text-muted transition-transform duration-quick", filtersOpen && "rotate-90")}
              />
            </button>

            <div className={cn("flex-col gap-tight sm:flex sm:flex-row sm:items-center", filtersOpen ? "flex" : "hidden")}>
              <div role="group" aria-label={t("filterState")} className="flex gap-inline rounded-full border border-line bg-card p-inline">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={status === s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex h-11 flex-1 items-center justify-center gap-tight whitespace-nowrap rounded-full px-comfortable text-sm transition-colors duration-quick sm:flex-none",
                      status === s ? "bg-ember-solid font-semibold text-white" : "text-muted",
                    )}
                  >
                    {t(s === "all" ? "filterAll" : s === "open" ? "filterOpen" : "filterFull")}
                    <span className="font-mono text-[13px] opacity-80">{counts[s]}</span>
                  </button>
                ))}
              </div>
              <select
                value={bookingFilter}
                onChange={(e) => setBookingFilter(e.target.value)}
                aria-label={t("filterBooking")}
                className="h-12 w-full min-w-0 rounded-full border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse sm:max-w-[240px]"
              >
                <option value="all">{t("allBookings")}</option>
                {bookingOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Out of service, said once. Eighteen identical OUT rows down one
              day is the mistake the dashboard already fixed by naming a closed
              lane once rather than once an hour. */}
          {day.closed.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-comfortable rounded-go border border-warning/40 bg-warning-wash px-section py-comfortable">
              <Wrench size={18} strokeWidth={1.5} className="shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t("outNotice", { name: l.name })}</p>
                <p className="text-[13px] text-muted">{l.resource?.outOfServiceReason || t("noReason")}</p>
              </div>
              <Button shape="pill" variant="secondary" onClick={() => openOos(l)}>
                {t("returnToService")}
              </Button>
            </div>
          ))}

          {productsQ.loading ? (
            <div aria-busy="true" className="flex animate-pulse flex-col gap-tight">
              <div className="h-4 w-1/3 rounded-full bg-line" />
              <div className="h-14 rounded-go bg-line" />
              <div className="h-14 rounded-go bg-line" />
              <div className="h-14 rounded-go bg-line" />
            </div>
          ) : day.slots.length === 0 ? (
            <EmptyState title={t("noSessionsTitle")} message={t("noSessionsMessage")} />
          ) : shown.length === 0 ? (
            <EmptyState title={t("noMatchTitle")} message={t("noMatchMessage")} />
          ) : (
            <div className="flex flex-col gap-comfortable">
              {pastGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEarlier((v) => !v)}
                  className="flex h-11 items-center gap-tight self-start rounded-full border border-line bg-card px-comfortable text-[13px] text-muted"
                >
                  <ChevronUp size={15} strokeWidth={1.5} aria-hidden className={cn("transition-transform duration-quick", showEarlier && "rotate-180")} />
                  {showEarlier ? t("hideEarlier") : t("showEarlier", { count: pastGroups.length })}
                </button>
              )}
              {visibleGroups.map((g, i) => {
                const open = g.slots.filter((s) => s.kind === "open").length;
                /* The first group at or after now carries the marker, instead
                   of a separate line above it. Two time labels eight pixels
                   apart — "Now · 12:00" over "12:00" — said the same thing
                   twice and read as noise. */
                const marksNow = now !== null && pastGroups.length > 0 && g.minutes >= now && (i === 0 || visibleGroups[i - 1].minutes < now);
                return (
                  <section key={g.time} className="flex flex-col gap-tight">
                    {/* The head of everything that starts then, drawn as the
                        divider it is: label, rule, count. The time is Inter,
                        not DM Mono — the type spec reserves mono for
                        identifiers, and a clock time is table text. */}
                    <h2 className="sticky top-0 z-10 flex items-center gap-comfortable bg-surface py-tight">
                      {marksNow && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-ember-solid" />}
                      <span className={cn("shrink-0 text-base font-semibold", marksNow && "text-brand-foreground")}>{g.time}</span>
                      {marksNow && <span className="shrink-0 text-[13px] font-semibold text-brand-foreground">{t("nowLabel")}</span>}
                      <span aria-hidden className={cn("h-px min-w-tight flex-1", marksNow ? "bg-ember-solid/30" : "bg-hairline")} />
                      <span className="shrink-0 text-[13px] text-muted">{open > 0 ? t("nFree", { count: open }) : t("allTaken")}</span>
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-tight">
                      {g.slots.map((s) => (
                        <SlotRow key={s.key} slot={s} onTake={() => take(s)} onSell={sell} onOos={openOos} t={t} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="lg:hidden">
            <FieldsCard lanes={day.lanes} onOos={openOos} t={t} />
          </div>
        </div>

        {/* A till is 1024px or wider and the day only ever used 672 of it. The
            width buys a standing answer to "what can I sell this minute"
            beside the schedule, rather than a wider row. */}
        <aside className="hidden lg:sticky lg:top-section lg:flex lg:flex-col lg:gap-section">
          {liveNow && (
            <div className="flex flex-col gap-tight rounded-go p-section go-surface">
              <p className="flex items-center gap-tight">
                <span aria-hidden className="h-2 w-2 rounded-full bg-ember-solid" />
                <span className="text-[13px] font-semibold text-brand-foreground">{t("nowAt", { time: minutesToTime(now ?? 0) })}</span>
              </p>
              <p className="text-lg font-semibold">{liveNow.onNow.length > 0 ? t("freeNow", { count: liveNow.onNow.length }) : t("noneFreeNow")}</p>
              {liveNow.onNow.length === 0 && liveNow.next && <p className="text-[13px] text-muted">{t("nextFree")}</p>}
              {(liveNow.onNow.length > 0 ? liveNow.onNow.slice(0, 3) : liveNow.next ? [liveNow.next] : []).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => take(s)}
                  className="flex min-h-11 items-center gap-tight rounded-go-sm border border-line px-comfortable py-tight text-left active:bg-ember/10"
                >
                  {liveNow.onNow.length === 0 && <span className="shrink-0 text-[13px] text-muted">{s.time}</span>}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.lane.name}</span>
                  <span className="shrink-0 text-[13px] font-semibold text-brand-foreground">{priceLabel(s, t)}</span>
                </button>
              ))}
              {liveNow.onNow.length === 0 && !liveNow.next && <p className="text-[13px] text-muted">{t("noneLeftToday")}</p>}
            </div>
          )}
          <FieldsCard lanes={day.lanes} onOos={openOos} t={t} />
        </aside>
      </div>

      {/* Two bookings can run on one field, so a free hour has two prices.
          Asked here rather than guessed — the old screen answered it by
          listing the same hour twice, once per booking. */}
      <Modal open={!!chooser} onClose={() => setChooser(null)} title={chooser ? t("sellAs", { name: chooser.lane.name, time: chooser.time }) : ""}>
        <div className="flex flex-col gap-tight">
          <p className="text-[13px] text-muted">{t("sellAsHelp")}</p>
          {chooser?.options.map((o) => (
            <button
              key={o.product.id}
              type="button"
              onClick={() => {
                setChooser(null);
                sell(o.product, chooser);
              }}
              className="flex min-h-14 items-center justify-between gap-comfortable rounded-go border border-line px-section py-comfortable text-left active:bg-ember/10"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{o.product.name}</span>
              <span className="shrink-0 font-semibold text-brand-foreground">{formatPriceShort(o.price)}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!oos}
        onClose={() => setOos(null)}
        title={oos ? (oos.outOfService ? t("oosTitleOut", { name: oos.name }) : t("oosTitleIn", { name: oos.name })) : ""}
        footer={
          oos?.outOfService ? (
            <>
              <Button shape="pill" variant="secondary" onClick={() => setOos(null)}>
                {t("cancel")}
              </Button>
              <Button shape="pill" loading={oosSaving} onClick={() => saveOos(false)}>
                {t("returnToService")}
              </Button>
            </>
          ) : (
            <>
              <Button shape="pill" variant="secondary" onClick={() => setOos(null)}>
                {t("cancel")}
              </Button>
              <Button shape="pill" loading={oosSaving} onClick={() => saveOos(true)}>
                {t("markOutOfService")}
              </Button>
            </>
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

const pad = (n: number) => String(n).padStart(2, "0");
const minutesToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
/** What the slot costs. "from" is earned by two ways in at two different
 *  prices — on a field where both bookings cost the same it states nothing. */
function priceLabel(slot: DaySlot, t: T): string {
  if (slot.price === null) return "";
  const amount = formatPriceShort(slot.price);
  const varies = slot.options.length > 1 && slot.options[slot.options.length - 1].price !== slot.options[0].price;
  return varies ? t("fromPrice", { amount }) : amount;
}

/** A row states the thing, what is left of it, and what it costs.
 *
 *  A sellable row is a lifted card and a taken one is a flat outline, so
 *  "not this one" is carried by shape and surface before colour — the rule
 *  the scan result and the slot matrix already follow. The whole card is the
 *  target, which is also what takes the old 46×36 Sell button and 36×36
 *  overflow button off a screen that is touch at every width. */
function SlotRow({
  slot,
  onTake,
  onSell,
  onOos,
  t,
}: {
  slot: DaySlot;
  onTake: () => void;
  onSell: (p: Product, s?: DaySlot) => void;
  onOos: (l: Lane) => void;
  t: T;
}) {
  const open = slot.kind === "open";
  const session = slot.lane.isSession;
  const left = slot.remaining ?? 0;
  const total = slot.capacity ?? 0;
  const pressure = sessionPressure(left, total);
  const tight = pressure === "critical" || pressure === "low";

  /* Carbon's rule: the primary action stays visible and the rest go behind an
     overflow. An overflow with nothing in it is worse than none, so a row only
     carries one where it has something to offer — a field always can be taken
     out of service, and a shared field can be sold as either booking without
     going through the chooser. */
  const items: ActionMenuItem[] = [];
  if (open && slot.options.length > 1) {
    for (const o of slot.options) {
      items.push({
        key: o.product.id,
        label: t("sellAsBooking", { name: o.product.name }),
        icon: <Tag size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />,
        onSelect: () => onSell(o.product, slot),
      });
    }
  }
  if (slot.lane.resource) {
    items.push({
      key: "oos",
      label: t("markOutOfService"),
      icon: <Wrench size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />,
      separated: items.length > 0,
      onSelect: () => onOos(slot.lane),
    });
  }

  return (
    <div
      data-row
      data-kind={open ? "open" : "full"}
      className={cn(
        "flex min-h-16 items-center gap-tight rounded-go px-section py-tight",
        open ? "go-surface" : "border border-line",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[15px] font-semibold", !open && "text-muted")}>{slot.lane.name}</span>
        {/* The money leads the second line rather than taking a column of its
            own: at 320px a name, a price and two controls cannot all have
            room, and the name is the thing that distinguishes one row from
            the next. */}
        <span className="flex min-w-0 items-center gap-tight text-[14px] text-muted">
          {open && slot.price !== null && <span className="shrink-0 font-semibold text-fg">{priceLabel(slot, t)}</span>}
          {open && slot.price !== null && !session && <span aria-hidden className="shrink-0">·</span>}
          {session ? (
            open ? (
              <>
                <span aria-hidden className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-line">
                  <span
                    className={cn("block h-full rounded-full", tight ? "bg-ember-solid" : "bg-inverse/40")}
                    style={{ width: `${total ? Math.round((left / total) * 100) : 0}%` }}
                  />
                </span>
                <span className={cn("truncate", tight && "font-semibold text-brand-foreground")}>
                  {pressure === "critical" ? t("seatsLeft", { count: left }) : t("seatsFree", { count: left })}
                </span>
              </>
            ) : (
              <span className="truncate">{t("stateFull")}</span>
            )
          ) : (
            <span className="truncate">{slot.lane.sub}</span>
          )}
        </span>
      </span>

      {open ? (
        <Button shape="pill" className="shrink-0" onClick={onTake}>
          {t("sell")}
        </Button>
      ) : slot.waitlist && slot.lane.products[0] ? (
        <Button shape="pill" variant="secondary" className="shrink-0" onClick={onTake}>
          {t("waitlist")}
        </Button>
      ) : (
        <span className="shrink-0 rounded-full border border-line px-comfortable py-inline text-[13px] text-muted">{session ? t("stateFull") : t("stateBooked")}</span>
      )}
      {items.length > 0 ? (
        <ActionMenu shape="go" items={items} label={t("rowMenu", { name: slot.lane.name, time: slot.time })} />
      ) : (
        <span aria-hidden className="h-11 w-11 shrink-0" />
      )}
    </div>
  );
}

/** The register of fields and courts: what state each is in, and the one
 *  control that changes it. That control used to be a per-slot overflow
 *  button, which put a resource-level action on eighteen rows of one field. */
function FieldsCard({ lanes, onOos, t }: { lanes: Lane[]; onOos: (l: Lane) => void; t: T }) {
  if (lanes.length === 0) return null;
  return (
    <section className="flex flex-col gap-tight rounded-go p-section go-surface">
      <h2 className="text-sm font-semibold">{t("fieldsTitle")}</h2>
      {lanes.map((l, i) => {
        const out = !!l.resource?.outOfService;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onOos(l)}
            className={cn("flex min-h-11 items-center gap-comfortable text-left active:bg-ember/10", i > 0 && "border-t border-hairline pt-tight")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{l.name}</span>
              <span className={cn("block truncate text-[13px]", out ? "text-warning" : "text-muted")}>{out ? t("stateOut") : t("inService")}</span>
            </span>
            <ChevronRight size={18} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
          </button>
        );
      })}
    </section>
  );
}

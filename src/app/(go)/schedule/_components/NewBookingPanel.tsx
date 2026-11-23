"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Lock, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { Checkbox, Notice } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/duration";
import { formatClockMin, formatClockRange, formatMoney, formatPriceShort } from "@/lib/format";
import { freeGuides, type Operator, type Product, type Resource, type Staff } from "@/lib/api";
import { toMinutes } from "@/lib/schedule";
import {
  activeTiersOf,
  freeProvidersAt,
  patternOf,
  resolveDraft,
} from "@/lib/sale/selection";
import { priceSale, type SaleItem } from "@/lib/sale/saleMath";
import {
  draftFor,
  fits,
  lengthChoice,
  placesOf,
  priceOn,
  slotSpan,
  spanMinutes,
  type RangeCtx,
} from "@/lib/sale/rangeBooking";
import {
  anytimeOptions,
  openSlotsFor,
  optionsInRange,
  type OpenOption,
} from "@/app/(os)/calendar/_components/openSlots";
import { primaryButton, secondaryButton } from "../../_components/ActionBar";
import { Stepper } from "../../_components/Stepper";
import { Tile } from "../../_components/Tiles";
import type { Column } from "../_lib/board";
import { selKey, type DraftSel, type Ghost } from "../_lib/fluid";

/** What the panel hands back when the cashier presses "Add to sale". */
export interface PanelAdd {
  items: SaleItem[];
  /** A show or a tour: the places to keep for this till while the sale is open. */
  session?: { product: Product; time: string; seats: number };
}

export interface PanelHold {
  product: Product;
  resourceId: string;
  resourceName: string;
  start: number;
  end: number;
}

/** What one booking asks once it has been chosen from the list. */
interface Pick {
  selKey: string;
  key: string;
  laneId: string | null;
  length: number | null;
  qty: Record<string, number>;
  party: number | null;
  providerId: string;
  guideId: string;
  validityId?: string;
  waiver: boolean;
}

/**
 * New booking: the panel the board's drawn span opens.
 *
 * It follows the OS calendar's quick-create (docs: BookingPanel) in the till's
 * language. The span on the board is a question — "what can I sell between 2:00
 * and 4:15?" — and the list is the answer: what fits THIS column first, then
 * what else is open then, then what has no time at all. Choosing a row folds
 * the list and asks only what that booking needs. The block drawn on the board
 * follows every answer, so the board, the price and the sale cannot disagree.
 */
export function NewBookingPanel({
  layout,
  date,
  dayLabel,
  today,
  nowMin,
  products,
  resources,
  staff,
  operator,
  columns,
  sel,
  bounds,
  onSel,
  onGhost,
  onClose,
  onAdd,
  onHold,
  onOpenTill,
  busy,
}: {
  layout: "side" | "sheet";
  date: string;
  dayLabel: string;
  today: string;
  nowMin: number;
  products: Product[];
  resources: Resource[];
  staff: Staff[];
  operator: Operator | undefined;
  columns: Column[];
  sel: DraftSel;
  /** The free time the span may stretch within: the run it sits in. */
  bounds: [number, number];
  onSel: (sel: DraftSel) => void;
  onGhost: (ghost: Ghost | null) => void;
  onClose: () => void;
  onAdd: (add: PanelAdd) => void;
  onHold: (hold: PanelHold) => void;
  onOpenTill: (productId: string, time?: string, resourceId?: string) => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const key = selKey(sel);
  const column = columns.find((c) => c.id === sel.columnId) ?? null;

  // ── what is open in the span ─────────────────────────────────────────────
  const slots = useMemo(() => openSlotsFor(products, date, today, nowMin), [products, date, today, nowMin]);
  const ctx = useMemo<RangeCtx>(() => ({ date, nowMin, slots, resources, team: staff }), [date, nowMin, slots, resources, staff]);
  const timed = useMemo(
    () => optionsInRange(products, slots, date, sel.start, sel.end, today, nowMin),
    [products, slots, date, sel.start, sel.end, today, nowMin],
  );
  /* A donation has no ticket to count; it is taken at the till. */
  const anytime = useMemo(
    () => anytimeOptions(products, date, today).filter((o) => o.product.tiers.some((x) => x.active && !x.donation)),
    [products, date, today],
  );

  const fitsColumn = (o: OpenOption) => {
    if (!column) return true;
    if (column.kind === "provider") return o.kind === "provider" && !!o.time && freeProvidersAt(o.product, date, o.time).includes(column.id);
    return o.resourceId === column.id || !!o.lanes?.some((l) => l.resourceId === column.id);
  };
  const here = column ? timed.filter(fitsColumn) : [];
  const elsewhere = column && here.length > 0 ? timed.filter((o) => !fitsColumn(o)) : [];
  const leading = column && here.length > 0 ? here : timed;

  // ── the chosen booking and its answers ───────────────────────────────────
  const [raw, setRaw] = useState<Pick | null>(null);
  const pick = raw && raw.selKey === key ? raw : null;
  const all = [...timed, ...anytime];
  const chosen = pick ? (all.find((o) => o.key === pick.key) ?? null) : null;
  const [moreOpen, setMoreOpen] = useState(false);
  const [allDayOpen, setAllDayOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const tiersOf = (p: Product) => activeTiersOf(p).filter((x) => !x.donation);
  const choose = (o: OpenOption) => {
    const room = o.time ? sel.end - toMinutes(o.time) : null;
    const first = tiersOf(o.product)[0];
    const places = placesOf(o);
    setProblem(null);
    setRaw({
      selKey: key,
      key: o.key,
      laneId: column?.kind === "resource" && places.includes(column.id) ? column.id : null,
      length: lengthChoice(ctx, o, room).start,
      qty: first ? { [first.id]: 1 } : {},
      party: null,
      providerId: column?.kind === "provider" ? column.id : "",
      guideId: "",
      waiver: false,
    });
  };
  const patch = (p: Partial<Pick>) => {
    setProblem(null);
    setRaw((r) => (r ? { ...r, ...p } : r));
  };

  const lengthInfo = chosen ? lengthChoice(ctx, chosen, null) : { ok: [] as number[], start: null };
  const lengths = chosen ? lengthInfo.ok : [];
  const len = pick && pick.length != null && lengths.includes(pick.length) ? pick.length : (lengths[0] ?? null);
  const sells = !!chosen && (chosen.kind === "slot" || chosen.kind === "flexible");
  const laneFree = (id: string) => !!chosen && (len == null || fits(ctx, chosen, id, len));
  const lane = chosen?.lanes
    ? (chosen.lanes.find((l) => l.resourceId === pick?.laneId && laneFree(l.resourceId)) ??
      [...chosen.lanes]
        .filter((l) => laneFree(l.resourceId))
        .sort(
          (a, b) =>
            priceOn(ctx, chosen, a.resourceId, len) - priceOn(ctx, chosen, b.resourceId, len) ||
            a.laneName.localeCompare(b.laneName, undefined, { numeric: true }),
        )[0] ??
      null)
    : null;
  const resourceId = chosen ? (chosen.resourceId ?? lane?.resourceId) : undefined;
  const laneName = chosen ? (chosen.laneName ?? lane?.laneName ?? null) : null;
  const noRoom = !!chosen && sells && (!resourceId || lengths.length === 0);

  const seatMap = !!chosen && ["seats", "sectioned"].includes(patternOf(chosen.product));
  const freeGuideIds = chosen?.kind === "session" ? freeGuides(chosen.product, date, chosen.time!) : [];
  const guideId = pick && freeGuideIds.includes(pick.guideId) ? pick.guideId : (freeGuideIds[0] ?? "");
  const freeProviders = chosen?.kind === "provider" && chosen.time ? freeProvidersAt(chosen.product, date, chosen.time) : [];
  const providerId = pick && freeProviders.includes(pick.providerId) ? pick.providerId : "";

  const draft = chosen && pick && !noRoom && !seatMap
    ? draftFor(ctx, chosen, { resourceId, length: len, qty: pick.qty, providerId, guideId, validityId: pick.validityId })
    : null;
  const resolved = chosen && draft ? resolveDraft(chosen.product, draft, "sched", { resources, team: staff }) : null;
  const partyMin = chosen?.product.policies?.partyMin ?? 1;
  const partyMax = chosen?.product.policies?.partyMax ?? 30;
  const party = Math.min(partyMax, Math.max(partyMin, pick?.party ?? partyMin));
  const items: SaleItem[] = !resolved ? [] : sells ? resolved.items.map((i) => ({ ...i, partySize: party })) : resolved.items;
  const total = items.length ? priceSale(items, { products, operator }).total : 0;
  const tiers = chosen ? tiersOf(chosen.product) : [];
  const people = tiers.reduce((s, x) => s + (pick?.qty[x.id] ?? 0) * (x.admits ?? 1), 0);
  const seatsOver = chosen?.kind === "session" && chosen.remaining != null && people > chosen.remaining;
  const needsWaiver = !!chosen?.product.policies?.waiver;

  // ── the block on the board ───────────────────────────────────────────────
  const ghost: Ghost | null = (() => {
    if (!chosen || !chosen.time || seatMap) return null;
    const start = toMinutes(chosen.time);
    if (sells) {
      if (!resourceId) return null;
      return { columnId: resourceId, start, end: start + spanMinutes(chosen, len), title: chosen.product.name };
    }
    if (chosen.kind === "provider") {
      const who = resolved?.items[0]?.resourceId ?? providerId ?? freeProviders[0];
      return who ? { columnId: who, start, end: start + spanMinutes(chosen, null), title: chosen.product.name } : null;
    }
    return null;
  })();
  const ghostKey = ghost ? JSON.stringify(ghost) : "";
  useEffect(() => {
    onGhost(ghost);
    // Keyed on the value, not the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostKey]);

  // ── doing it ─────────────────────────────────────────────────────────────
  const add = () => {
    if (!chosen || !pick) return;
    if (noRoom) return setProblem(t("fluid.noRoom"));
    if (!resolved || resolved.missing === "tickets") return setProblem(t("sheet.pickTickets"));
    if (resolved.missing) return setProblem(t("fluid.cannotYet"));
    if (seatsOver) return setProblem(t("sheet.tooMany", { count: chosen.remaining ?? 0 }));
    if (needsWaiver && !pick.waiver) return setProblem(t("bar.waiverMissing"));
    onAdd({ items, session: chosen.kind === "session" && chosen.time ? { product: chosen.product, time: chosen.time, seats: people } : undefined });
  };
  const hold = () => {
    if (!chosen?.time || !resourceId) return;
    const start = toMinutes(chosen.time);
    onHold({ product: chosen.product, resourceId, resourceName: laneName ?? "", start, end: start + spanMinutes(chosen, len) });
  };

  // ── drawing the pieces ───────────────────────────────────────────────────
  const rangeOf = (o: OpenOption) => {
    if (!o.time) return t("fluid.allDay");
    const start = toMinutes(o.time);
    const room = sel.end - start;
    const mins = o.kind === "slot" ? (lengthChoice(ctx, o, room).start ?? slotSpan(o)) : spanMinutes(o, o.minutes ?? null);
    return `${formatClockRange(start, start + mins)} · ${formatDuration(mins)}`;
  };
  const whereOf = (o: OpenOption): string => {
    if (o.kind === "session") return o.remaining != null ? t("board.seatsLeft", { count: o.remaining }) : "";
    if (o.kind === "provider") return o.time ? t("fluid.peopleFree", { count: freeProvidersAt(o.product, date, o.time).length }) : "";
    if (o.kind === "anytime") return o.remaining != null ? t("fluid.placesLeft", { count: o.remaining }) : t("fluid.noTimeNeeded");
    if (o.lanes) return t("fluid.placesOpen", { count: o.lanes.length });
    return o.laneName ?? "";
  };
  const priceOf = (o: OpenOption): { text: string; from: boolean } => {
    if (o.kind === "slot" && o.time) {
      const mins = lengthChoice(ctx, o, sel.end - toMinutes(o.time)).start ?? slotSpan(o);
      const places = placesOf(o);
      return { text: formatPriceShort(places.length ? Math.min(...places.map((r) => priceOn(ctx, o, r, mins))) : o.price), from: false };
    }
    return { text: formatPriceShort(o.price), from: o.kind === "session" || o.kind === "anytime" || o.kind === "provider" };
  };

  const row = (o: OpenOption) => {
    const pr = priceOf(o);
    return (
      <li key={o.key}>
        <button
          type="button"
          onClick={() => choose(o)}
          className="flex min-h-14 w-full items-start gap-comfortable rounded-inner bg-card px-comfortable py-tight text-left ring-1 ring-inset ring-line transition-colors duration-quick hover:bg-nav-hover active:bg-nav-selected"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-md font-semibold leading-tight text-fg rail:text-base">{o.product.name}</span>
            <span className="block text-sm tabular-nums leading-tight text-muted">{rangeOf(o)}</span>
            {whereOf(o) && <span className="block text-sm leading-tight text-muted">{whereOf(o)}</span>}
          </span>
          <span className="shrink-0 whitespace-nowrap text-right">
            {pr.from && <span className="block text-sm leading-tight text-muted">{t("fluid.from")}</span>}
            <span className="block text-md font-semibold tabular-nums text-fg rail:text-base">{pr.text}</span>
          </span>
          <ChevronRight size={16} strokeWidth={2} aria-hidden className="mt-1 shrink-0 text-muted" />
        </button>
      </li>
    );
  };
  const more = (open: boolean, set: (v: boolean) => void, label: string, list: OpenOption[], id: string) => (
    <div className="flex flex-col gap-tight">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => set(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-tight rounded-inner px-comfortable text-left text-base font-medium text-fg ring-1 ring-inset ring-line hover:bg-nav-hover"
      >
        <span>{label}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>
      {open && <ul id={id} className="flex flex-col gap-tight">{list.map(row)}</ul>}
    </div>
  );

  const [lo, hi] = bounds;
  const quarter = 15;
  const whenWhere = column ? column.name : t("fluid.anyPlace");
  const nothing = !timed.length && !anytime.length;

  const body = (
    <>
      {/* ── when ── (a phone has the footer line once something is chosen) */}
      <div className={cn("flex flex-col gap-tight", chosen && layout === "sheet" && "hidden")}>
        <p className="text-md font-semibold tabular-nums text-fg rail:text-base">
          {dayLabel} · {formatClockRange(sel.start, sel.end)}
        </p>
        <p className="text-sm text-muted">{whenWhere} · {formatDuration(sel.end - sel.start)}</p>
        {/* On a phone the block's own handles do this; the steppers are for a
            keyboard and a mouse, where a quarter hour is a click. */}
        <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-tight", layout === "sheet" && "hidden")}>
          <TimeStep
            label={t("fluid.start")}
            value={sel.start}
            onLess={() => onSel({ ...sel, start: Math.max(lo, sel.start - quarter) })}
            onMore={() => onSel({ ...sel, start: Math.min(sel.end - quarter, sel.start + quarter) })}
            lessLabel={t("fluid.startEarlier")}
            moreLabel={t("fluid.startLater")}
            atMin={sel.start <= lo}
            atMax={sel.start >= sel.end - quarter}
          />
          <TimeStep
            label={t("fluid.end")}
            value={sel.end}
            onLess={() => onSel({ ...sel, end: Math.max(sel.start + quarter, sel.end - quarter) })}
            onMore={() => onSel({ ...sel, end: Math.min(hi, sel.end + quarter) })}
            lessLabel={t("fluid.endEarlier")}
            moreLabel={t("fluid.endLater")}
            atMin={sel.end <= sel.start + quarter}
            atMax={sel.end >= hi}
          />
        </div>
      </div>

      {!chosen ? (
        <div className="flex flex-col gap-comfortable">
          {nothing && <Notice tone="warning" size="sm">{t("fluid.nothing")}</Notice>}
          {leading.length > 0 && (
            <div className="flex flex-col gap-tight">
              <h3 className="text-base font-semibold text-fg">
                {column && here.length > 0 ? t("fluid.onPlace", { place: column.name }) : t("fluid.openThen")}
              </h3>
              <ul className="flex flex-col gap-tight">{leading.map(row)}</ul>
            </div>
          )}
          {elsewhere.length > 0 && more(moreOpen, setMoreOpen, t("fluid.alsoOpen", { count: elsewhere.length }), elsewhere, "nb-also")}
          {anytime.length > 0 && more(allDayOpen, setAllDayOpen, t("fluid.allDayMore", { count: anytime.length }), anytime, "nb-allday")}
        </div>
      ) : (
        <div className="flex flex-col gap-comfortable">
          <div className={cn("flex items-start gap-comfortable rounded-inner bg-subtle px-comfortable py-tight", layout === "sheet" && "hidden")}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-md font-semibold leading-tight text-fg">{chosen.product.name}</span>
              <span className="block text-sm tabular-nums leading-tight text-muted">
                {chosen.time ? formatClockRange(toMinutes(chosen.time), toMinutes(chosen.time) + spanMinutes(chosen, len)) : t("fluid.allDay")}
                {laneName ? ` · ${laneName}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setRaw(null)}
              className="inline-flex min-h-11 shrink-0 items-center px-2 text-base font-semibold text-brand-foreground"
            >
              {t("fluid.change")}
            </button>
          </div>

          {seatMap ? (
            <Notice tone="info" size="sm">{t("fluid.seatMap")}</Notice>
          ) : (
            <>
              {sells && lengths.length > 0 && (
                <Section label={t("fluid.length")}>
                  <LengthControl
                    lengths={lengths}
                    value={len}
                    onChange={(m) => patch({ length: m })}
                    lessLabel={t("fluid.shorter")}
                    moreLabel={t("fluid.longer")}
                  />
                </Section>
              )}

              {sells && chosen.lanes && (
                <Section label={t("fluid.place")}>
                  <div role="radiogroup" aria-label={t("fluid.place")} className="flex flex-wrap gap-tight">
                    {chosen.lanes.map((l) => {
                      const free = laneFree(l.resourceId);
                      const on = lane?.resourceId === l.resourceId;
                      return (
                        <Tile
                          key={l.resourceId}
                          role="radio"
                          aria-checked={on}
                          selected={on}
                          off={!free}
                          disabled={!free}
                          onClick={() => patch({ laneId: l.resourceId })}
                          className="min-h-12 flex-col gap-0 px-3"
                        >
                          <span className={cn("text-base font-semibold leading-tight", !free && "line-through")}>{l.laneName}</span>
                          <span className="text-sm leading-tight tabular-nums">{free ? formatPriceShort(priceOn(ctx, chosen, l.resourceId, len)) : t("fluid.busy")}</span>
                        </Tile>
                      );
                    })}
                  </div>
                </Section>
              )}

              {noRoom && <Notice tone="danger" size="sm">{t("fluid.noRoom")}</Notice>}

              {chosen.kind === "session" && freeGuideIds.length > 1 && (
                <Section label={t("fluid.guide")}>
                  <div role="radiogroup" className="flex flex-wrap gap-tight">
                    {freeGuideIds.map((id) => (
                      <Tile key={id} role="radio" aria-checked={guideId === id} selected={guideId === id} onClick={() => patch({ guideId: id })} className="min-h-11 px-3 text-base">
                        {staff.find((s) => s.id === id)?.name ?? id}
                      </Tile>
                    ))}
                  </div>
                </Section>
              )}

              {chosen.kind === "provider" && (
                <Section label={t("fluid.with")}>
                  <div role="radiogroup" className="flex flex-wrap gap-tight">
                    <Tile role="radio" aria-checked={providerId === ""} selected={providerId === ""} onClick={() => patch({ providerId: "" })} className="min-h-11 px-3 text-base">
                      {t("fluid.firstAvailable")}
                    </Tile>
                    {freeProviders.map((id) => {
                      const extra = chosen.product.providerPremiums?.[id] ?? 0;
                      return (
                        <Tile key={id} role="radio" aria-checked={providerId === id} selected={providerId === id} onClick={() => patch({ providerId: id })} className="min-h-11 px-3 text-base">
                          {staff.find((s) => s.id === id)?.name ?? id}
                          {extra > 0 ? ` +${formatPriceShort(extra)}` : ""}
                        </Tile>
                      );
                    })}
                  </div>
                </Section>
              )}

              {!sells && tiers.length > 0 && (
                <Section label={chosen.kind === "provider" ? t("fluid.choose") : t("fluid.tickets")}>
                  <ul className="flex flex-col gap-tight">
                    {tiers.map((x) => (
                      <li key={x.id} className="flex min-h-14 items-center gap-comfortable rounded-inner bg-subtle px-comfortable py-tight">
                        <span className="min-w-0 flex-1">
                          <span className="block text-md font-semibold leading-tight text-fg rail:text-base">{x.name}</span>
                          <span className="block text-sm tabular-nums leading-tight text-muted">
                            {formatPriceShort(x.price)}
                            {(x.admits ?? 1) > 1 && ` · ${t("sheet.admitsCount", { count: x.admits ?? 1 })}`}
                          </span>
                        </span>
                        <Stepper
                          value={pick?.qty[x.id] ?? 0}
                          onChange={(v) => patch({ qty: { ...(pick?.qty ?? {}), [x.id]: Math.max(0, v) } })}
                          lessLabel={t("sheet.lessOf", { name: x.name })}
                          moreLabel={t("sheet.moreOf", { name: x.name })}
                        />
                      </li>
                    ))}
                  </ul>
                  {chosen.remaining != null && <p className="text-sm text-muted">{t("sheet.seatsLeftNow", { count: chosen.remaining })}</p>}
                </Section>
              )}

              {sells && (
                <Section label={t("fluid.group")}>
                  <div className="flex min-h-14 items-center gap-comfortable rounded-inner bg-subtle px-comfortable py-tight">
                    <span className="min-w-0 flex-1 text-md font-semibold text-fg rail:text-base">{t("partyOf", { size: party })}</span>
                    <Nudge
                      atMin={party <= partyMin}
                      atMax={party >= partyMax}
                      onLess={() => patch({ party: party - 1 })}
                      onMore={() => patch({ party: party + 1 })}
                      lessLabel={t("fluid.fewer")}
                      moreLabel={t("fluid.more")}
                    />
                  </div>
                </Section>
              )}

              {chosen.kind === "anytime" && (chosen.product.validityOptions?.length ?? 0) > 1 && (
                <Section label={t("fluid.validFor")}>
                  <div role="radiogroup" className="flex flex-wrap gap-tight">
                    {chosen.product.validityOptions!.map((v) => {
                      const on = (pick?.validityId ?? chosen.product.validityOptions![0].id) === v.id;
                      return (
                        <Tile key={v.id} role="radio" aria-checked={on} selected={on} onClick={() => patch({ validityId: v.id })} className="min-h-11 px-3 text-base">
                          {v.label}
                        </Tile>
                      );
                    })}
                  </div>
                </Section>
              )}

              {needsWaiver && (
                <Checkbox
                  checked={!!pick?.waiver}
                  onCheckedChange={(c) => patch({ waiver: c })}
                  invalid={problem === t("bar.waiverMissing")}
                  label={t("bar.waiver")}
                />
              )}

              {seatsOver && <Notice tone="danger" size="sm">{t("sheet.tooMany", { count: chosen.remaining ?? 0 })}</Notice>}
              {problem && <Notice tone="danger" size="sm">{problem}</Notice>}
            </>
          )}
        </div>
      )}
    </>
  );

  const footer = chosen && (
    <div className="flex flex-col gap-tight border-t border-line px-comfortable pb-comfortable pt-tight">
      {!seatMap && (
        <div className="flex items-baseline justify-between gap-comfortable">
          <p className="min-w-0 truncate text-sm text-muted">{summaryOf()}</p>
          <p className="shrink-0 text-lg font-semibold tabular-nums text-fg" aria-live="polite">{formatMoney(total)} <span className="text-sm font-normal text-muted">{t("bar.withVat")}</span></p>
        </div>
      )}
      <div className="flex gap-tight">
        {seatMap ? (
          <button type="button" className={primaryButton("h-13 rail:h-10", "flex-1")} onClick={() => onOpenTill(chosen.product.id, chosen.time, undefined)}>
            <ShoppingBag size={20} strokeWidth={2} aria-hidden />
            <span className="truncate">{t("fluid.openTill")}</span>
          </button>
        ) : (
          <>
            {sells && resourceId && (
              <button type="button" className={secondaryButton("h-13 rail:h-10", "flex-1")} onClick={hold} disabled={busy}>
                <Lock size={20} strokeWidth={2} aria-hidden />
                <span className="truncate">{t("sheet.hold")}</span>
              </button>
            )}
            <button type="button" className={primaryButton("h-13 rail:h-10", "flex-[2]")} onClick={add} disabled={busy}>
              {/* The total, VAT included, is on the line just above; a price in the
                  button too was cut to "৳2,…" in the desktop panel. */}
              <span className="truncate">{t("fluid.add")}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  function summaryOf(): string {
    if (!chosen) return "";
    const parts: string[] = [];
    if (chosen.time) parts.push(formatClockRange(toMinutes(chosen.time), toMinutes(chosen.time) + spanMinutes(chosen, len)));
    if (laneName) parts.push(laneName);
    if (sells) parts.push(t("partyOf", { size: party }));
    else if (people > 0) parts.push(t("sheet.peopleCount", { count: people }));
    return parts.join(" · ");
  }

  const shell = (
    <section
      data-new-booking
      aria-label={t("fluid.panelLabel")}
      id={layout === "sheet" ? "sched-bar" : undefined}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-card",
        layout === "side"
          ? "absolute inset-0 rounded-card ring-1 ring-inset ring-line"
          : "fixed inset-x-tight bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 max-h-[46dvh] rounded-card go-raised sm:left-1/2 sm:right-auto sm:w-[30rem] sm:-translate-x-1/2 dark:border dark:border-strong",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-tight px-comfortable pb-1 pt-tight">
        <h2 className="min-w-0 flex-1 truncate text-md font-semibold text-fg">{chosen && layout === "sheet" ? chosen.product.name : t("fluid.newBooking")}</h2>
        {chosen && layout === "sheet" && (
          <button type="button" onClick={() => setRaw(null)} className="inline-flex min-h-11 shrink-0 items-center px-2 text-base font-semibold text-brand-foreground">
            {t("fluid.change")}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("fluid.clearAria")}
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-control text-muted hover:bg-muted-wash active:bg-muted-wash"
        >
          <X size={20} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-comfortable overflow-y-auto overscroll-contain px-comfortable pb-comfortable pt-1">{body}</div>
      {footer}
    </section>
  );
  return layout === "side" ? <div className="relative w-[22.5rem] shrink-0">{shell}</div> : shell;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-tight">
      <h3 className="text-base font-semibold text-fg">{label}</h3>
      {children}
    </div>
  );
}

/** Two round buttons, no number: the value is in words beside them. */
function Nudge({ onLess, onMore, atMin, atMax, lessLabel, moreLabel }: { onLess: () => void; onMore: () => void; atMin: boolean; atMax: boolean; lessLabel: string; moreLabel: string }) {
  const btn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-line text-fg transition-colors duration-quick active:bg-muted-wash disabled:text-faint disabled:active:bg-transparent rail:h-10 rail:w-10";
  return (
    <span className="inline-flex shrink-0 items-center gap-tight">
      <button type="button" className={btn} onClick={onLess} disabled={atMin} aria-label={lessLabel}>
        <Minus size={18} strokeWidth={2} aria-hidden />
      </button>
      <button type="button" className={btn} onClick={onMore} disabled={atMax} aria-label={moreLabel}>
        <Plus size={18} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}

/** A time with a quarter hour either side of it. */
function TimeStep({
  label,
  value,
  onLess,
  onMore,
  lessLabel,
  moreLabel,
  atMin,
  atMax,
}: {
  label: string;
  value: number;
  onLess: () => void;
  onMore: () => void;
  lessLabel: string;
  moreLabel: string;
  atMin: boolean;
  atMax: boolean;
}) {
  const btn = "inline-flex size-11 items-center justify-center rounded-control text-fg ring-1 ring-inset ring-line active:bg-muted-wash disabled:text-faint rail:size-9";
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={onLess} disabled={atMin} aria-label={lessLabel}>
        <Minus size={16} strokeWidth={2.5} aria-hidden />
      </button>
      <span className="min-w-[4.75rem] text-center">
        <span className="block text-sm leading-tight text-muted">{label}</span>
        <span className="block text-base font-semibold tabular-nums leading-tight text-fg">{formatClockMin(value)}</span>
      </span>
      <button type="button" className={btn} onClick={onMore} disabled={atMax} aria-label={moreLabel}>
        <Plus size={16} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

/** How long, from the lengths this booking sells here: chips while there are
 *  a few, a stepper (and the one chosen, in words) when quarter hours make a
 *  keypad of it. */
function LengthControl({
  lengths,
  value,
  onChange,
  lessLabel,
  moreLabel,
}: {
  lengths: number[];
  value: number | null;
  onChange: (m: number) => void;
  lessLabel: string;
  moreLabel: string;
}) {
  const i = value == null ? 0 : Math.max(0, lengths.indexOf(value));
  /* The round lengths people ask for — and always the one in force, so a
     dragged 2 hr 15 min is on screen as the thing chosen. */
  const round = lengths.length <= 6 ? lengths : lengths.filter((m) => m % 30 === 0).slice(0, 6);
  const chips = value != null && lengths.includes(value) && !round.includes(value) ? [...round, value].sort((a, b) => a - b) : round;
  return (
    <div className="flex flex-col gap-tight">
      <div className="flex min-h-14 items-center gap-comfortable rounded-inner bg-subtle px-comfortable py-tight">
        <span className="min-w-0 flex-1 text-md font-semibold tabular-nums text-fg rail:text-base">{formatDuration(lengths[i] ?? 0)}</span>
        <Nudge atMin={i <= 0} atMax={i >= lengths.length - 1} onLess={() => onChange(lengths[i - 1])} onMore={() => onChange(lengths[i + 1])} lessLabel={lessLabel} moreLabel={moreLabel} />
      </div>
      {chips.length > 1 && (
        <div role="radiogroup" className="flex flex-wrap gap-tight">
          {chips.map((m) => (
            <Tile key={m} role="radio" aria-checked={value === m} selected={value === m} onClick={() => onChange(m)} className="min-h-11 px-3 text-base tabular-nums">
              {formatDuration(m)}
            </Tile>
          ))}
        </div>
      )}
    </div>
  );
}

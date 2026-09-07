"use client";

/* ── The selection, inline ─────────────────────────────────────────────────
 *
 * The v1 till asks these questions inside a bottom sheet over the product
 * wall. That is the right shape when the answer has to go into a cart panel
 * somewhere else — the sheet is the trip to the cart and back.
 *
 * There is no cart here, so there is no trip. The questions render in the
 * page, in the block the item will remain as, and the block collapses into
 * its own answer when it is finished. Nothing covers anything.
 *
 * Two consequences worth stating, because they are the reason this is not
 * just the sheet with its chrome removed:
 *
 * - There is no close button and no scrim, so a half-answered selection is
 *   never dismissed by a stray tap on the background.
 * - Every question stays visible after it is answered, so changing the time
 *   after choosing tickets does not mean reopening anything.
 */

import { useState } from "react";
import { useApiQuery } from "@/lib/useApi";
import { useTranslations } from "next-intl";
import { Minus, Plus, X } from "lucide-react";
import { Avatar, BlockedNotice, ChoiceCard, DateStrip } from "@/components/ui";
import { availableSeats, explainUnavailable, type Product, type Resource, type Staff } from "@/lib/api";
import { applyResourceRate } from "@/lib/api";
import { productDurationPrice } from "@/lib/duration";
import { resolveProductPrice } from "@/lib/pricing";
import { DEMO_TODAY, demoDay, isGuided, slotISO, toMinutes, toTime } from "@/lib/schedule";
import { formatDay, formatMoney } from "@/lib/format";
import { formatDuration } from "@/lib/duration";
import {
  activeTiersOf,
  basePriceOf,
  dailyLeft,
  flexDurations,
  flexStartBlocked,
  flexTimes,
  freeProvidersAt,
  openDates,
  patternOf,
  providerMinutes,
  providerTimes,
  sessionRows,
  type Draft,
} from "../_lib/selection";
import { SessionList } from "../../_components/SessionList";
import { getResourceMatrix } from "@/lib/api";

/** A question's heading. One shape for all of them, so the block reads as a
 *  sequence of decisions rather than as loose controls. */
function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-section first:mt-0">
      <p className="mb-tight text-[14px] font-semibold text-fg">{label}</p>
      {children}
    </div>
  );
}

export function SelectionInline({
  product,
  draft,
  onDraft,
  currency,
  team,
  resources,
  seatsElsewhere,
}: {
  product: Product;
  draft: Draft;
  onDraft: (next: Draft) => void;
  currency: string;
  team: Staff[];
  /** Only to name a slot picked on a day the strip has since moved off. */
  resources: Resource[];
  seatsElsewhere: (productId: string, slotStart: string) => number;
}) {
  const TOMORROW = demoDay(1);
  const t = useTranslations("sell");
  const ts = useTranslations("pos");
  const [blocked, setBlocked] = useState<string | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  // Seats are the one shape whose availability is asynchronous, so it is
  // fetched here rather than pretended at in the pure resolver.
  const seatsQ = useApiQuery(
    () => (product.layoutId ? availableSeats(product.id) : Promise.resolve({ ok: true as const, data: [] })),
    [product.id, product.layoutId],
  );

  const pattern = patternOf(product);
  const tiers = activeTiersOf(product);
  const set = (patch: Partial<Draft>) => onDraft({ ...draft, ...patch });

  if (pattern === "unsupported") {
    return (
      <div className="rounded-go border border-dashed border-strong bg-subtle/40 p-section">
        <p className="text-[14px] font-medium">{t("unsupported.title")}</p>
        <p className="mt-inline text-[13px] text-muted">{t("unsupported.body")}</p>
      </div>
    );
  }

  // Which patterns ask "when". A course runs on dates it already owns, and a
  // seat map has no date of its own in this catalogue, so neither offers one.
  const dated =
    pattern === "sessions" ||
    pattern === "resourceSlot" ||
    pattern === "flexible" ||
    pattern === "provider" ||
    product.bookingType === "BT-02" ||
    product.bookingType === "BT-06";
  const chips = dated ? openDates(product) : [];
  const cap = product.schedule?.dailyCapacity ?? 0;

  /* ── Date ─────────────────────────────────────────────────────────────
     A wrapping grid with the calendar beneath it — never a row that scrolls
     sideways. Days already carrying part of the sale are marked, so a
     selection spanning several is legible from the picker itself. */
  const dateStrip = (
    <Step label={t("step.date")}>
      <DateStrip
        dates={chips}
        value={draft.date}
        onChange={(d) => set({ date: d, slotTime: undefined, guideId: undefined, providerId: undefined })}
        today={DEMO_TODAY}
        tomorrow={TOMORROW}
        min={DEMO_TODAY}
        marked={[...new Set((draft.slots ?? []).map((x) => x.date))]}
        labels={{ today: t("date.today"), tomorrow: t("date.tomorrow"), pick: t("date.more") }}
      />
    </Step>
  );

  /* ── Today's allowance (BT-06) ────────────────────────────────────────── */
  const capacityPanel = (() => {
    if (product.bookingType !== "BT-06" || cap <= 0) return null;
    const left = dailyLeft(product, draft.date);
    const pctLeft = Math.max(0, Math.min(100, (left / cap) * 100));
    const low = left <= Math.max(1, Math.floor(cap * 0.2));
    return (
      <Step label={t("step.allowance")}>
        <div className="rounded-go border border-line bg-card p-comfortable">
          <div className="flex items-baseline justify-between gap-tight">
            <span className="min-w-0 truncate text-[13px] text-muted">{t("allowance.remaining")}</span>
            <span className={`shrink-0 text-[15px] font-semibold ${low ? "text-brand-foreground" : ""}`}>
              {t("allowance.ofTotal", { left, total: cap })}
            </span>
          </div>
          <div className="mt-tight h-1.5 overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full ${low ? "bg-ember" : "bg-success"}`} style={{ width: `${pctLeft}%` }} />
          </div>
        </div>
      </Step>
    );
  })();

  /* ── Sessions ─────────────────────────────────────────────────────────── */
  const rows = pattern === "sessions" ? sessionRows(product, draft.date, seatsElsewhere, team) : [];
  const guided = isGuided(product.bookingType);
  const sessions = pattern === "sessions" && (
    <Step label={t(guided ? "step.departure" : "step.session")}>
      {rows.length === 0 ? (
        <p className="rounded-go border border-line bg-subtle/40 p-comfortable text-[13px] text-muted">
          {t("session.noneToday")}
        </p>
      ) : (
        <SessionList
          currency={currency}
          selected={draft.slotTime}
          sessions={rows.map((r) => ({
            time: r.time,
            price: r.price,
            capacity: r.capacity,
            left: r.left,
            blockedReason: r.blockedReason ? t(`session.${r.blockedReason}` as never) : null,
            meta: r.meta,
            waitlist: r.waitlist,
          }))}
          onSelect={(time) => {
            const row = rows.find((r) => r.time === time);
            // A departure needs a guide as well as seats; picking the first
            // free one is what the counter would do anyway, and it stays
            // changeable on the row below.
            set({ slotTime: time, guideId: row?.freeGuideIds[0] });
            setBlocked(null);
          }}
          onBlocked={(time, reason) => {
            // One answer to "why can I not sell this?" — the same explainer
            // the rest of the app uses, so a held session names the hold
            // rather than saying a flat "full".
            const row = rows.find((r) => r.time === time);
            const why = explainUnavailable({
              product,
              date: draft.date,
              slotStart: slotISO(draft.date, time),
              remaining: row?.left ?? 0,
            });
            setBlocked(why?.message ?? reason);
          }}
        />
      )}
    </Step>
  );

  /* ── Who is leading it ────────────────────────────────────────────────── */
  const guideStep = (() => {
    if (!guided || !draft.slotTime) return null;
    const row = rows.find((r) => r.time === draft.slotTime);
    const ids = product.schedule?.guideIds ?? [];
    if (ids.length === 0) return null;
    return (
      <Step label={t("step.guide")}>
        <div className="flex flex-wrap gap-tight">
          {ids.map((id) => {
            const person = team.find((s) => s.id === id);
            const free = row?.freeGuideIds.includes(id) ?? false;
            return (
              <ChoiceCard
                key={id}
                selected={draft.guideId === id}
                disabled={!free}
                onClick={() => set({ guideId: id })}
                className="flex min-w-[140px] flex-1 flex-col gap-inline py-tight pl-comfortable pr-7"
              >
                <span className="min-w-0 truncate text-[14px] font-medium">{person?.name ?? id}</span>
                <span className={`text-[13px] ${free ? "text-success" : "text-muted"}`}>
                  {t(free ? "guide.available" : "guide.busy")}
                </span>
              </ChoiceCard>
            );
          })}
        </div>
      </Step>
    );
  })();

  /* ── Fixed slots on a resource (BT-04) ─────────────────────────────────
     A SET of slots, not one choice. Tap to take an hour, tap it again to give
     it back, and the set survives changing the day — so "Field 1 at six on
     Saturday and Field 2 at seven on Sunday" is one sale rather than two trips
     through the same screen.

     This does not use the shared SlotMatrix: that component asks for a single
     answer and is used by the two other tills, so teaching it a second mode
     would put a variant's behaviour inside everybody's component. */
  const matrix = pattern === "resourceSlot" ? getResourceMatrix(product, draft.date) : [];
  const picked = draft.slots ?? [];
  const isPicked = (rid: string, time: string) =>
    picked.some((x) => x.date === draft.date && x.resourceId === rid && x.time === time);
  const toggleSlot = (rid: string, time: string) => {
    const on = isPicked(rid, time);
    set({
      slots: on
        ? picked.filter((x) => !(x.date === draft.date && x.resourceId === rid && x.time === time))
        : [...picked, { date: draft.date, time, resourceId: rid }],
    });
    setBlocked(null);
  };

  const resourceStep = pattern === "resourceSlot" && (
    <>
      {matrix.length === 0 ? (
        <Step label={t("step.slot")}>
          <p className="rounded-go border border-line bg-subtle/40 p-comfortable text-[13px] text-muted">
            {t("session.noneToday")}
          </p>
        </Step>
      ) : (
        matrix.map((row) => {
          const times = row.slots;
          const takenHere = picked.filter((x) => x.date === draft.date && x.resourceId === row.resource.id).length;
          return (
            <Step
              key={row.resource.id}
              label={`${row.resource.name}${takenHere ? ` · ${t("slot.chosenCount", { count: takenHere })}` : ""}`}
            >
              {row.resource.outOfService ? (
                <p className="rounded-go border border-line bg-subtle/40 p-comfortable text-[13px] text-muted">
                  {t("flex.outOfService")}
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-tight">
                  {times.map((sl) => {
                    const on = isPicked(row.resource.id, sl.time);
                    const price = applyResourceRate(
                      resolveProductPrice(product, draft.date, sl.time, basePriceOf(product)),
                      product.schedule?.sessionMinutes ?? 60,
                      row.resource,
                    );
                    return (
                      <button
                        key={sl.time}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          if (!sl.available && !on) {
                            const why = explainUnavailable({
                              product,
                              date: draft.date,
                              slotStart: slotISO(draft.date, sl.time),
                              remaining: 0,
                            });
                            setBlocked(why?.message ?? t("session.soldOut"));
                            return;
                          }
                          toggleSlot(row.resource.id, sl.time);
                        }}
                        className={`flex min-h-[52px] flex-col items-center justify-center rounded-go border px-inline text-[13px] transition-colors duration-quick ${
                          on
                            ? "border-ember bg-ember font-medium text-white"
                            : sl.available
                              ? "border-line bg-card active:bg-ember/10"
                              : "border-line bg-subtle text-muted line-through"
                        }`}
                      >
                        <span>{sl.time}</span>
                        <span className={on ? "text-[12px] text-white/80" : "text-[12px] text-muted"}>
                          {formatMoney(price, currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Step>
          );
        })
      )}

      {/* What has been taken so far, across every day — the only place a
          multi-day selection can be read in full, and where a slot on a day
          you are no longer looking at can still be given back. */}
      {picked.length > 0 && (
        <Step label={t("slot.chosen")}>
          <div className="overflow-hidden rounded-go border border-line bg-card">
            {[...picked]
              .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
              .map((x, i) => {
                const res = resources.find((r) => r.id === x.resourceId);
                return (
                  <div
                    key={`${x.date}|${x.resourceId}|${x.time}`}
                    className={`flex items-center gap-tight p-comfortable ${i ? "border-t border-line" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {res?.name ?? x.resourceId} · {x.time}
                      </span>
                      <span className="block text-[12px] text-muted">
                        {formatDay(x.date, { weekday: true })}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={t("slot.remove", { time: x.time })}
                      onClick={() => set({ slots: picked.filter((y) => y !== x) })}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-danger active:bg-ember/10"
                    >
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                );
              })}
          </div>
        </Step>
      )}
    </>
  );

  /* ── How long the pass runs (BT-02) ────────────────────────────────────
     The lengths come from the product, so an operator selling one length gets
     no picker at all rather than a row with a single chip in it. */
  const validityStep = (() => {
    const options = product.bookingType === "BT-02" ? (product.validityOptions ?? []) : [];
    if (options.length < 2) return null;
    return (
      <Step label={t("step.validity")}>
        <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
          {options.map((v) => (
            <ChoiceCard
              key={v.id}
              selected={draft.validityId === v.id}
              onClick={() => set({ validityId: v.id })}
              className="flex min-h-[56px] flex-col justify-center gap-inline py-tight pl-comfortable pr-7"
            >
              <span className="min-w-0 truncate text-[14px] font-medium">{v.label}</span>
              {(v.priceDelta ?? 0) > 0 && (
                <span className="text-[13px] text-brand-foreground">+{formatMoney(v.priceDelta ?? 0, currency)}</span>
              )}
            </ChoiceCard>
          ))}
        </div>
      </Step>
    );
  })();

  /* ── A lane by the hour (BT-05) ─────────────────────────────────────────
     Three questions, in the order a counter asks them: how long, which lane,
     what time. Duration first, because it decides which starts are even
     possible — a three-hour booking cannot start an hour before closing. */
  const flexible = pattern === "flexible" && (() => {
    const durations = flexDurations(product);
    const minutes = draft.durationMinutes ?? durations[0];
    const lanes = getResourceMatrix(product, draft.date).map((r) => r.resource);
    const times = flexTimes(product, draft.date);
    const price = (time: string, laneId?: string) => {
      const lane = lanes.find((l) => l.id === laneId);
      return applyResourceRate(
        productDurationPrice(product, draft.date, time, minutes, basePriceOf(product)),
        minutes,
        lane,
      );
    };
    const blockWord = (b: "past" | "closes" | "taken") =>
      t(b === "past" ? "flex.past" : b === "closes" ? "flex.closes" : "flex.taken");

    return (
      <>
        <Step label={t("step.duration")}>
          <div className="flex flex-wrap gap-tight">
            {durations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  // Changing the length can invalidate the chosen start, so it
                  // is cleared rather than left pointing at a span that no
                  // longer fits.
                  const stillFits =
                    draft.slotTime &&
                    !flexStartBlocked(product, draft.date, draft.slotTime, d, draft.resourceId, 12 * 60);
                  set({ durationMinutes: d, slotTime: stillFits ? draft.slotTime : undefined });
                }}
                className={`h-12 min-w-[72px] flex-1 rounded-full border px-comfortable text-[14px] transition-colors duration-quick ${
                  minutes === d
                    ? "border-ember bg-ember/10 font-medium text-brand-foreground"
                    : "border-line bg-card active:bg-ember/10"
                }`}
              >
                {formatDuration(d)}
              </button>
            ))}
          </div>
        </Step>

        <Step label={t("step.lane", { noun: lanes[0]?.nounSingular ?? t("slot.resource") })}>
          {/* Wraps rather than scrolls: a lane that has scrolled out of view
              is a lane nobody knows is free. */}
          <div className="grid grid-cols-3 gap-tight sm:grid-cols-4">
            <ChoiceCard
              hideCheck
              selected={!draft.resourceId}
              onClick={() => set({ resourceId: undefined })}
              className="flex min-h-[56px] flex-col justify-center gap-inline px-comfortable py-tight"
            >
              <span className="text-[14px] font-medium">{t("flex.any")}</span>
              <span className="text-[12px] text-muted">{t("flex.anyHint")}</span>
            </ChoiceCard>
            {lanes.map((l) => (
              <ChoiceCard
                key={l.id}
                hideCheck
                disabled={l.outOfService}
                selected={draft.resourceId === l.id}
                onClick={() => set({ resourceId: l.id, slotTime: undefined })}
                className="flex min-h-[56px] flex-col justify-center gap-inline px-comfortable py-tight"
              >
                <span className="truncate text-[14px] font-medium">{l.name}</span>
                <span className="text-[12px] text-muted">
                  {l.outOfService ? t("flex.outOfService") : formatMoney(price("12:00", l.id), currency)}
                </span>
              </ChoiceCard>
            ))}
          </div>
        </Step>

        <Step label={t("step.start")}>
          <div className="grid grid-cols-4 gap-tight">
            {times.map((time) => {
              const blocked = flexStartBlocked(product, draft.date, time, minutes, draft.resourceId, 12 * 60);
              const on = draft.slotTime === time;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => (blocked ? setBlocked(blockWord(blocked)) : set({ slotTime: time }))}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-go border px-inline text-[13px] transition-colors duration-quick ${
                    on
                      ? "border-ember bg-ember font-medium text-white"
                      : blocked
                        ? "border-line bg-subtle text-muted line-through"
                        : "border-line bg-card active:bg-ember/10"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
          {/* The end time is the thing a customer asks for, and it is never
              typed — it falls out of the start and the length. */}
          {draft.slotTime && (
            <p className="mt-tight text-[13px] text-muted">
              {t("flex.window", {
                from: draft.slotTime,
                to: toTime(toMinutes(draft.slotTime) + minutes),
              })}
            </p>
          )}
        </Step>
      </>
    );
  })();

  /* ── An appointment with a person (BT-10) ───────────────────────────────
     Time first, then who is free at it — asking for a therapist before a time
     offers people who may not be available when the customer wants to come. */
  const providerStep = pattern === "provider" && (() => {
    const mins = providerMinutes(product);
    const times = providerTimes(product, draft.date);
    const people = (product.providerIds ?? []);
    const freeNow = draft.slotTime ? freeProvidersAt(product, draft.date, draft.slotTime) : [];
    return (
      <>
        <Step label={t("step.appointment")}>
          <div className="grid grid-cols-4 gap-tight">
            {times.map((time) => {
              const anyFree = freeProvidersAt(product, draft.date, time).length > 0;
              const on = draft.slotTime === time;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() =>
                    anyFree
                      ? set({ slotTime: time, providerId: undefined })
                      : setBlocked(t("provider.noneFree", { time }))
                  }
                  className={`flex min-h-12 items-center justify-center rounded-go border px-inline text-[13px] transition-colors duration-quick ${
                    on
                      ? "border-ember bg-ember font-medium text-white"
                      : anyFree
                        ? "border-line bg-card active:bg-ember/10"
                        : "border-line bg-subtle text-muted line-through"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
          <p className="mt-tight text-[13px] text-muted">{t("provider.length", { length: formatDuration(mins) })}</p>
        </Step>

        {draft.slotTime && people.length > 0 && (
          <Step label={t("step.provider")}>
            <div className="flex flex-col gap-tight">
              {people.map((pid) => {
                const who = team.find((x) => x.id === pid);
                const free = freeNow.includes(pid);
                const premium = product.providerPremiums?.[pid] ?? 0;
                const assigned = (draft.providerId ?? freeNow[0]) === pid;
                return (
                  <ChoiceCard
                    key={pid}
                    hideCheck
                    disabled={!free}
                    selected={assigned}
                    onClick={() => set({ providerId: pid })}
                    className="flex items-center gap-comfortable py-tight pl-comfortable pr-comfortable"
                  >
                    <Avatar name={who?.name ?? pid} size={36} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[14px] font-medium">{who?.name ?? pid}</span>
                      <span className={`block text-[13px] ${free ? "text-success" : "text-muted"}`}>
                        {t(free ? "guide.available" : "guide.busy")}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[13px] text-muted">
                      {premium > 0 ? t("provider.premium", { amount: formatMoney(premium, currency) }) : t("provider.standard")}
                    </span>
                  </ChoiceCard>
                );
              })}
            </div>
          </Step>
        )}
      </>
    );
  })();

  /* ── A course (BT-13) ───────────────────────────────────────────────────
     Nothing to configure: it runs on dates it already owns, and the only
     decision left is how many places. Stated in the affirmative rather than
     as a list that looks like a choice still to be made. */
  const courseStep = pattern === "course" && (() => {
    const dates = [...(product.courseDates ?? [])].sort();
    if (dates.length === 0) return null;
    const day = (iso: string) => new Date(`${iso}T12:00:00`);
    const weekdays = [...new Set(dates.map((x) => new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(day(x))))];
    const range = `${new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(day(dates[0]))}–${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(day(dates[dates.length - 1]))}`;
    return (
      <Step label={t("step.course")}>
        <div className="rounded-go border border-success/30 bg-success/10 p-comfortable">
          <p className="text-[14px] font-medium text-success">{t("course.ready")}</p>
          <p className="mt-inline text-[13px]">
            {t("course.runs", { count: dates.length, days: weekdays.join(" & "), range })}
          </p>
          <button
            type="button"
            onClick={() => setCourseOpen((v) => !v)}
            className="mt-tight min-h-11 text-[13px] font-medium text-brand-foreground underline-offset-2 hover:underline"
          >
            {t(courseOpen ? "course.hideDates" : "course.showDates")}
          </button>
          {courseOpen && (
            <ul className="mt-tight flex flex-col gap-inline">
              {dates.map((x) => (
                <li key={x} className="text-[13px] tabular-nums">{formatDay(x, { weekday: true })}</li>
              ))}
            </ul>
          )}
        </div>
      </Step>
    );
  })();

  /* ── A named seat (BT-07) ───────────────────────────────────────────────
     A spatial diagram, so it keeps its own rules: seats are small, and the
     selected one is SOLID ember with white text rather than a saturated
     version of its own category colour — which is the one comparison a 28px
     tile cannot carry. */
  const seatStep = pattern === "seats" && (() => {
    const rows = seatsQ.data ?? [];
    if (seatsQ.loading) {
      return (
        <Step label={t("step.seats")}>
          <div aria-busy="true" className="flex animate-pulse flex-col gap-tight">
            <div className="h-4 w-1/3 rounded-go-sm bg-line" />
            <div className="h-16 w-full rounded-go-sm bg-line" />
          </div>
        </Step>
      );
    }
    const picked = draft.seats ?? [];
    const isPicked = (label: string) => picked.some((x) => x.label === label);
    const maxY = Math.max(0, ...rows.map((r) => r.posY));
    const categories = [...new Map(rows.map((r) => [r.categoryUid, r])).values()];
    return (
      <Step label={t("step.seats")}>
        <p className="mb-tight rounded-go bg-subtle py-inline text-center text-[12px] tracking-widest text-muted">
          {t("seats.screen")}
        </p>
        <div className="-mx-comfortable overflow-x-auto px-comfortable pb-1">
          <div className="inline-flex flex-col gap-inline">
            {Array.from({ length: maxY + 1 }, (_, y) => (
              <div key={y} className="flex gap-inline">
                {rows
                  .filter((r) => r.posY === y)
                  .sort((a, b) => a.posX - b.posX)
                  .map((seat) => {
                    const on = isPicked(seat.label);
                    return (
                      <button
                        key={seat.label}
                        type="button"
                        title={`${seat.label} · ${seat.categoryName} · ${formatMoney(seat.price, currency)}`}
                        disabled={!seat.available && !on}
                        onClick={() =>
                          set({
                            seats: on
                              ? picked.filter((x) => x.label !== seat.label)
                              : [...picked, {
                                  label: seat.label,
                                  categoryUid: seat.categoryUid,
                                  categoryName: seat.categoryName,
                                  price: seat.price,
                                }],
                          })
                        }
                        className={`flex size-7 shrink-0 items-center justify-center rounded-go-sm border text-[9px] ${
                          on
                            ? "border-ember bg-ember font-semibold text-white"
                            : seat.available
                              ? "border-line bg-card"
                              : "border-line bg-subtle text-faint line-through"
                        }`}
                        style={!on && seat.available ? { backgroundColor: `${seat.color}22`, borderColor: seat.color } : undefined}
                      >
                        {seat.label.replace(/[^0-9]/g, "")}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-tight flex flex-wrap gap-comfortable text-[12px] text-muted">
          {categories.map((c) => (
            <span key={c.categoryUid} className="flex items-center gap-inline">
              <span
                className="size-3 rounded-go-sm border"
                style={{ backgroundColor: `${c.color}22`, borderColor: c.color }}
                aria-hidden
              />
              {c.categoryName} · {formatMoney(c.price, currency)}
            </span>
          ))}
          <span className="flex items-center gap-inline">
            <span className="size-3 rounded-go-sm border border-ember bg-ember" aria-hidden />
            {t("seats.selected")}
          </span>
        </div>
      </Step>
    );
  })();

  /* ── Tickets ──────────────────────────────────────────────────────────── */
  const countable =
    pattern === "sectioned"
      ? (product.sections ?? []).map((x) => ({ id: x.id, name: x.name, price: x.price, admits: 1, ageNote: undefined as string | undefined }))
      : tiers.map((x) => ({ id: x.id, name: x.name, price: x.price, admits: x.admits, ageNote: x.ageNote }));
  const countsTickets =
    pattern !== "resourceSlot" && pattern !== "flexible" && pattern !== "seats";
  const tierStep = countsTickets && countable.length > 0 && (
    <Step label={t(pattern === "sectioned" ? "step.sections" : pattern === "course" ? "step.places" : "step.tickets")}>
      {/* One panel of hairline-separated rows. Each row states the three
          things in the order they are decided: what it is, who it admits,
          what it costs. Four bordered cards read as four unrelated objects. */}
      <div className="overflow-hidden rounded-go border border-line bg-card">
        {countable.map((tier) => {
          const price = draft.slotTime
            ? resolveProductPrice(product, draft.date, draft.slotTime, tier.price)
            : tier.price;
          const n = draft.qty[tier.id] ?? 0;
          const admits = (tier.admits ?? 1) > 1 ? ts("sheet.admits", { count: tier.admits ?? 1 }) : null;
          const note = [admits, tier.ageNote].filter(Boolean).join(" · ");
          return (
            <div key={tier.id} className="flex items-center gap-comfortable border-b border-line p-comfortable last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{tier.name}</p>
                {note && <p className="mt-inline truncate text-[12px] text-muted">{note}</p>}
                <p className="mt-inline text-[13px] font-medium text-brand-foreground">{formatMoney(price, currency)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-tight">
                <button
                  type="button"
                  aria-label={t("qty.less", { tier: tier.name })}
                  disabled={n === 0}
                  onClick={() => set({ qty: { ...draft.qty, [tier.id]: Math.max(0, n - 1) } })}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg disabled:text-faint active:bg-ember/10"
                >
                  <Minus size={16} strokeWidth={2} />
                </button>
                <span className="w-6 text-center text-[15px] font-semibold tabular-nums">{n}</span>
                <button
                  type="button"
                  aria-label={t("qty.more", { tier: tier.name })}
                  onClick={() => set({ qty: { ...draft.qty, [tier.id]: n + 1 } })}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg active:bg-ember/10"
                >
                  <Plus size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Step>
  );

  return (
    <div>
      {blocked && (
        <div className="mb-section">
          <BlockedNotice message={blocked} onDismiss={() => setBlocked(null)} />
        </div>
      )}
      {dated && dateStrip}
      {capacityPanel}
      {sessions}
      {guideStep}
      {resourceStep}
      {flexible}
      {providerStep}
      {courseStep}
      {seatStep}
      {validityStep}
      {tierStep}
    </div>
  );
}

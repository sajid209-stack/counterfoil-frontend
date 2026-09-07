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
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { BlockedNotice, ChoiceCard } from "@/components/ui";
import { explainUnavailable, type Product, type Staff } from "@/lib/api";
import { applyResourceRate } from "@/lib/api";
import { resolveProductPrice } from "@/lib/pricing";
import { DEMO_TODAY, isGuided, slotISO } from "@/lib/schedule";
import { formatDay, formatMoney } from "@/lib/format";
import {
  activeTiersOf,
  basePriceOf,
  dailyLeft,
  openDates,
  patternOf,
  sessionRows,
  type Draft,
} from "../_lib/selection";
import { SessionList } from "../../_components/SessionList";
import { SlotMatrix } from "../../_components/SlotMatrix";
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
  seatsElsewhere,
}: {
  product: Product;
  draft: Draft;
  onDraft: (next: Draft) => void;
  currency: string;
  team: Staff[];
  seatsElsewhere: (productId: string, slotStart: string) => number;
}) {
  const t = useTranslations("sell");
  const ts = useTranslations("pos");
  const [blocked, setBlocked] = useState<string | null>(null);
  const [moreDates, setMoreDates] = useState(false);

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

  const dated = pattern !== "tiered" || product.bookingType === "BT-02" || product.bookingType === "BT-06";
  const chips = dated ? openDates(product) : [];
  const cap = product.schedule?.dailyCapacity ?? 0;

  /* ── Date ─────────────────────────────────────────────────────────────── */
  const dateStrip = (
    <Step label={t("step.date")}>
      {/* One row that scrolls. A grid that wraps strands the calendar button
          beside a lone chip on a second row — the same defect the v1 sheet
          was fixed for. */}
      <div className="-mx-comfortable flex items-stretch gap-tight overflow-x-auto px-comfortable pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((d) => {
          const label = d === DEMO_TODAY ? t("date.today") : formatDay(d, { weekday: true });
          return (
            <ChoiceCard
              key={d}
              selected={draft.date === d}
              /* hideCheck, deliberately. ChoiceCard's corner check owns the
                 top-right 24px, and this card is 76px of centred text — the
                 badge landed on top of the month. Selection reads from the
                 ember ring and the ember type instead, which is the same
                 grayscale-legible treatment, minus the collision. */
              hideCheck
              onClick={() => set({ date: d, slotTime: undefined, resourceId: undefined, guideId: undefined })}
              className="flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-inline px-tight py-tight text-center"
            >
              <span className={`whitespace-nowrap text-[13px] font-medium leading-tight ${draft.date === d ? "text-brand-foreground" : ""}`}>
                {label.split(" ")[0]}
              </span>
              <span className={`whitespace-nowrap text-[13px] leading-tight ${draft.date === d ? "text-brand-foreground/70" : "text-muted"}`}>
                {d.slice(8, 10)} {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short" })}
              </span>
            </ChoiceCard>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreDates((v) => !v)}
          className="flex min-h-[56px] min-w-[76px] shrink-0 items-center justify-center rounded-go border border-line px-tight text-[13px] text-muted active:bg-ember/10"
        >
          {t("date.more")}
        </button>
      </div>
      {moreDates && (
        <input
          type="date"
          value={draft.date}
          min={DEMO_TODAY}
          onChange={(e) => set({ date: e.target.value, slotTime: undefined, resourceId: undefined, guideId: undefined })}
          aria-label={t("step.date")}
          className="mt-tight h-12 w-full rounded-go-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-ember"
        />
      )}
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

  /* ── Resource × time ──────────────────────────────────────────────────── */
  const matrix = pattern === "resourceSlot" ? getResourceMatrix(product, draft.date) : [];
  /* No Step label here: SlotMatrix heads its own two questions (the space,
     then that space's times), so wrapping it in a third heading printed
     "Time" above "Field" above "Time". */
  const resourceStep = pattern === "resourceSlot" && (
    <div className="mt-section first:mt-0">
      {matrix.length === 0 ? (
        <p className="rounded-go border border-line bg-subtle/40 p-comfortable text-[13px] text-muted">
          {t("session.noneToday")}
        </p>
      ) : (
        <SlotMatrix
          currency={currency}
          resourceNoun={matrix[0]?.resource.nounSingular ?? t("slot.resource")}
          selectedResourceId={draft.resourceId}
          selectedTime={draft.slotTime}
          onSelect={(rid, time) => { set({ resourceId: rid, slotTime: time }); setBlocked(null); }}
          onBlocked={setBlocked}
          rows={matrix.map((row) => ({
            id: row.resource.id,
            name: row.resource.name,
            outOfService: row.resource.outOfService,
            cells: row.slots.map((sl) => ({
              time: sl.time,
              available: sl.available,
              price: applyResourceRate(
                resolveProductPrice(product, draft.date, sl.time, basePriceOf(product)),
                product.schedule?.sessionMinutes ?? 60,
                row.resource,
              ),
            })),
          }))}
        />
      )}
    </div>
  );

  /* ── How long the pass runs (BT-02) ───────────────────────────────────── */
  const validityStep = (() => {
    const options = product.bookingType === "BT-02" ? (product.validityOptions ?? []) : [];
    if (options.length === 0) return null;
    return (
      <Step label={t("step.validity")}>
        <div className="flex flex-wrap gap-tight">
          {options.map((v) => (
            <ChoiceCard
              key={v.id}
              selected={draft.validityId === v.id}
              onClick={() => set({ validityId: v.id })}
              className="flex min-w-[120px] flex-1 flex-col gap-inline py-tight pl-comfortable pr-7"
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

  /* ── Tickets ──────────────────────────────────────────────────────────── */
  const tierStep = pattern !== "resourceSlot" && tiers.length > 0 && (
    <Step label={t("step.tickets")}>
      {/* One panel of hairline-separated rows. Each row states the three
          things in the order they are decided: what it is, who it admits,
          what it costs. Four bordered cards read as four unrelated objects. */}
      <div className="overflow-hidden rounded-go border border-line bg-card">
        {tiers.map((tier) => {
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
      {validityStep}
      {tierStep}
    </div>
  );
}

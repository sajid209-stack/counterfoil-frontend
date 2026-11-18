"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, TicketPercent, UserRound, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney, formatPriceShort } from "@/lib/format";
import { currencySymbol } from "@/lib/region";
import { AffixInput } from "@/components/ui";
import type { AppliedPromotion } from "@/lib/api";
import type { AttachedCustomer } from "./CustomerPicker";
import { Tile, TileGrid } from "../_components/Tiles";

/* ── The pieces the payment step is made of ───────────────────────────────
 *
 * Checkout is where a sale is finished, so it is where the things that change
 * what the customer pays are decided: who they are, whether they get a
 * discount, whether they have a promo code, and how much of it they pay now.
 * Shopify POS and Square both do this at checkout rather than as permanent rows
 * in the cart — a cart that offers a discount and a customer on every sale is
 * a cart whose lines are harder to read.
 *
 * The three rows (customer, discount, promo code) are rows of ONE card, divided
 * by hairlines: they are one question's worth of small decisions. How much to
 * pay now is a choice, so it is its own tiles. None of them hold sale state:
 * the till passes in what is true and what to do about it.
 */

/** A row that says what it currently IS — "None", "10%", "Add" — and opens its
 *  controls in place. In place, not in a second sheet over this one: the
 *  payment step is already a sheet. */
export function SaleRow({
  icon: Icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** The current state, in words. */
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center gap-comfortable py-comfortable text-left rail:min-h-11 rail:gap-tight rail:py-0"
      >
        <Icon size={22} strokeWidth={1.6} className="shrink-0 text-muted rail:size-[18px]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-md font-medium rail:text-base rail:font-normal">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-md font-medium text-fg rail:text-sm rail:font-normal rail:text-muted">{value}</span>
        <ChevronRight size={16} strokeWidth={1.5} className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-90")} aria-hidden />
      </button>
      {open && <div className="pb-comfortable rail:pb-tight">{children}</div>}
    </div>
  );
}

/** Who the sale is for. Empty it is one plain invitation; attached it is the
 *  person — the name wraps rather than truncating, because it is what a cashier
 *  checks against whoever is standing there, and the phone sits under it
 *  because two customers share a name far more often than a number. */
export function CustomerRow({
  attached,
  onOpen,
  onRemove,
}: {
  attached: AttachedCustomer | null;
  /** Given the row's button, so a desktop can hang the picker under it. */
  onOpen: (row: HTMLElement) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("pos");
  const detail = attached?.phone || attached?.email || "";
  return (
    <div className="flex items-center gap-tight border-b border-line last:border-b-0">
      <button type="button" data-customer-anchor onClick={(e) => onOpen(e.currentTarget)} className="flex min-h-14 min-w-0 flex-1 items-center gap-comfortable py-tight text-left rail:min-h-11 rail:gap-tight rail:py-0">
        <UserRound size={22} strokeWidth={1.6} className="shrink-0 text-muted rail:size-[18px]" aria-hidden />
        <span className="min-w-0 flex-1">
          {attached ? (
            <>
              <span className="block break-words text-md font-medium rail:text-base rail:font-semibold">{attached.name}</span>
              {detail && <span className="block truncate text-sm normal-nums text-muted">{detail}</span>}
            </>
          ) : (
            <span className="block text-md font-medium rail:text-base rail:font-normal">{t("cart.attachCustomer")}</span>
          )}
        </span>
        {attached && <span className="shrink-0 whitespace-nowrap text-md font-medium text-fg rail:text-sm rail:font-normal rail:text-muted">{t("cart.customerChange")}</span>}
        <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
      </button>
      {attached && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("pay.removeCustomer", { name: attached.name })}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-muted-wash rail:size-9"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A promo code. Closed it is a row like Discount — "Promo code … Add ›" — and
 *  an always-open field was an empty question on every sale. Pressing the row
 *  opens the field in place, with the cursor in it. Once a code has taken
 *  something off, the row gives way to a chip that says what and can be
 *  removed. A wrong code is refused in words under the field, and the row
 *  stays open so the cashier can type another. */
export function PromoCodeRow({
  applied,
  taken,
  input,
  onInput,
  onApply,
  onRemove,
  error,
  currency,
}: {
  applied: AppliedPromotion | null;
  /** What the code actually takes off this sale, after the other discounts. */
  taken: number;
  input: string;
  onInput: (v: string) => void;
  onApply: () => void;
  onRemove: () => void;
  /** Already in words. */
  error: string | null;
  currency: string;
}) {
  const t = useTranslations("pos");
  const id = useId();
  const [open, setOpen] = useState(false);
  const code = applied?.code ?? applied?.name ?? "";

  if (applied) {
    return (
      <div className="flex items-start gap-comfortable border-b border-line py-comfortable last:border-b-0 rail:gap-tight rail:py-tight">
        <TicketPercent size={22} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted rail:size-[18px]" aria-hidden />
        <div className="min-w-0 flex-1">
          <span id={id} className="block text-md font-medium rail:text-base rail:font-normal">{t("pay.promoCode")}</span>
          <div className="mt-tight flex">
            <span aria-labelledby={id} className="inline-flex min-h-11 max-w-full items-center gap-tight rounded-full border border-line bg-card pl-comfortable pr-1 text-md rail:min-h-9 rail:text-base">
              <Check size={16} strokeWidth={2.5} className="shrink-0 text-success" aria-hidden />
              <span className="min-w-0 truncate font-semibold">{code}</span>
              <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-muted">−{formatMoney(taken, currency)}</span>
              <button
                type="button"
                onClick={onRemove}
                aria-label={t("pay.removeCode", { code })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-muted-wash rail:size-9"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SaleRow icon={TicketPercent} label={t("pay.promoCode")} value={t("pay.promoAdd")} open={open} onToggle={() => setOpen((v) => !v)}>
      <div className="flex items-center gap-tight">
        {/* The field only exists once the row has been pressed, so focusing it
            on mount is the cursor landing where the cashier just tapped. */}
        <input
          id={id}
          autoFocus
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) onApply(); }}
          placeholder={t("pay.promoPlaceholder")}
          aria-label={t("pay.promoCode")}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-full border bg-card px-comfortable text-md uppercase rail:h-10 rail:text-base placeholder:normal-case placeholder:text-muted",
            error ? "border-danger" : "border-line",
          )}
        />
        <button
          type="button"
          onClick={onApply}
          disabled={!input.trim()}
          className="h-11 shrink-0 rounded-full border-2 border-line bg-card px-section text-md font-semibold rail:h-10 rail:border rail:text-base rail:font-medium text-fg transition-transform duration-quick active:scale-[0.98] disabled:opacity-50"
        >
          {t("pay.apply")}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-tight text-sm text-danger">
          {error}
        </p>
      )}
    </SaleRow>
  );
}

/** How much of the total is paid now. Full is the whole total; Minimum is the
 *  least the business or the booking accepts (offered only where there is one);
 *  Custom is any figure the cashier types between the two. This is the deposit
 *  checkout every booking system converges on (FareHarbor, Bookeo, Square's
 *  split tender): pay in full, pay the deposit, or another amount. A fixed
 *  "Half" was dropped: Custom covers it and every other figure a customer hands
 *  over, and a choice that only sometimes appears is one more thing to read. */
export type PayChoice = "full" | "minimum" | "custom";

/** A typed amount in the main unit → minor units. Accepts "1500", "1,500",
 *  "৳1500.50" and Bangla digits ("১৫০০"); null when it is not an amount. */
export function readAmount(text: string): number | null {
  const s = text
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[^\d.]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export type CustomCheck = { amount: number | null; error: "empty" | "low" | "high" | null };

/** Whether a typed amount can be taken now: at least `min`, at most `max` (the
 *  whole total). Anything else says why, so the field can say what to do. */
export function checkCustomAmount(text: string, min: number, max: number): CustomCheck {
  const amount = text.trim() ? readAmount(text) : null;
  if (amount == null || amount <= 0) return { amount: null, error: "empty" };
  if (amount < min) return { amount: null, error: "low" };
  if (amount > max) return { amount: null, error: "high" };
  return { amount, error: null };
}

/** The amount a Custom field opens on: what was being taken, in whole units
 *  where it is whole, so the cashier edits a real figure rather than a blank. */
export const amountText = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

/** How much of the total the customer pays now: Full, Minimum or Custom.
 *
 *  Each choice is its own tile, with the amount under the word, so a cashier who
 *  does not read the word reads the money. The chosen tile is the till's one
 *  look for "chosen": solid orange, white, a tick, the same as a chosen payment
 *  method. Custom opens one field right under the tiles, already holding the
 *  amount that was chosen and selected, so typing replaces it; under it, the
 *  range it must fall in, which turns into the correction when it does not. */
export function HowMuchNow({
  options,
  value,
  onChange,
  currency,
  custom,
}: {
  options: { id: Exclude<PayChoice, "custom">; label: string; amount: number }[];
  value: PayChoice;
  onChange: (c: PayChoice) => void;
  currency: string;
  custom: { text: string; onText: (text: string) => void; min: number; max: number; check: CustomCheck };
}) {
  const t = useTranslations("pos");
  const id = useId();
  const on = value === "custom";
  const range = { min: formatMoney(custom.min, currency), max: formatMoney(custom.max, currency) };
  const message = !on
    ? null
    : custom.check.error === "low"
      ? t("pay.customLow", range)
      : custom.check.error === "high"
        ? t("pay.customHigh", range)
        : custom.check.error === "empty" && custom.text.trim()
          ? t("pay.customNotAmount")
          : t("pay.customRange", range);
  const invalid = on && custom.check.error != null && (custom.check.error !== "empty" || !!custom.text.trim());
  const tile = "h-[4.25rem] rail:h-13 rail:min-h-13 rail:[&>span:last-child]:text-sm";
  return (
    <div className="flex flex-col gap-comfortable">
      <TileGrid cols={options.length + 1 >= 3 ? 3 : 2} role="radiogroup" aria-label={t("pay.howMuch")}>
        {options.map((o) => (
          <Tile
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            data-pay-choice={o.id}
            selected={value === o.id}
            onClick={() => onChange(o.id)}
            label={o.label}
            sub={<span className="tabular-nums">{formatPriceShort(o.amount, currency)}</span>}
            className={tile}
          />
        ))}
        <Tile
          role="radio"
          aria-checked={on}
          data-pay-choice="custom"
          selected={on}
          onClick={() => onChange("custom")}
          label={t("pay.custom")}
          sub={on && custom.check.amount != null ? <span className="tabular-nums">{formatPriceShort(custom.check.amount, currency)}</span> : t("pay.customSub")}
          className={tile}
        />
      </TileGrid>
      {on && (
        <div className="flex flex-col gap-inline" data-pay-custom>
          <label htmlFor={id} className="text-sm font-medium text-fg-secondary">
            {t("pay.customLabel")}
          </label>
          <AffixInput
            id={id}
            /* The field appears because the Custom tile was just pressed, so the
               cursor lands where the hand is; the figure is selected so the
               first key replaces it. */
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            prefix={currencySymbol(currency)}
            value={custom.text}
            onChange={(e) => custom.onText(e.target.value)}
            invalid={invalid}
            aria-describedby={`${id}-help`}
            className="h-12 rail:h-10"
            inputClassName="text-lg font-semibold tabular-nums rail:text-base"
          />
          <p id={`${id}-help`} role={invalid ? "alert" : undefined} className={cn("text-sm", invalid ? "text-danger" : "text-muted")}>
            {message}
          </p>
        </div>
      )}
    </div>
  );
}

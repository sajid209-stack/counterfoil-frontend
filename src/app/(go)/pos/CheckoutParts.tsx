"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, TicketPercent, UserRound, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney, formatPriceShort } from "@/lib/format";
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
        className="flex min-h-14 w-full items-center gap-comfortable py-comfortable text-left"
      >
        <Icon size={22} strokeWidth={1.6} className="shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-md font-medium">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-md font-medium text-fg">{value}</span>
        <ChevronRight size={16} strokeWidth={1.5} className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-90")} aria-hidden />
      </button>
      {open && <div className="pb-comfortable">{children}</div>}
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
  onOpen: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("pos");
  const detail = attached?.phone || attached?.email || "";
  return (
    <div className="flex items-center gap-tight border-b border-line last:border-b-0">
      <button type="button" onClick={onOpen} className="flex min-h-14 min-w-0 flex-1 items-center gap-comfortable py-tight text-left">
        <UserRound size={22} strokeWidth={1.6} className="shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          {attached ? (
            <>
              <span className="block break-words text-md font-medium">{attached.name}</span>
              {detail && <span className="block truncate text-sm normal-nums text-muted">{detail}</span>}
            </>
          ) : (
            <span className="block text-md font-medium">{t("cart.attachCustomer")}</span>
          )}
        </span>
        {attached && <span className="shrink-0 whitespace-nowrap text-md font-medium text-fg">{t("cart.customerChange")}</span>}
        <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
      </button>
      {attached && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("pay.removeCustomer", { name: attached.name })}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-muted-wash"
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
      <div className="flex items-start gap-comfortable border-b border-line py-comfortable last:border-b-0">
        <TicketPercent size={22} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <span id={id} className="block text-md font-medium">{t("pay.promoCode")}</span>
          <div className="mt-tight flex">
            <span aria-labelledby={id} className="inline-flex min-h-11 max-w-full items-center gap-tight rounded-full border border-line bg-card pl-comfortable pr-1 text-md">
              <Check size={16} strokeWidth={2.5} className="shrink-0 text-success" aria-hidden />
              <span className="min-w-0 truncate font-semibold">{code}</span>
              <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-muted">−{formatMoney(taken, currency)}</span>
              <button
                type="button"
                onClick={onRemove}
                aria-label={t("pay.removeCode", { code })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-muted-wash"
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
            "h-11 min-w-0 flex-1 rounded-full border bg-card px-comfortable text-md uppercase placeholder:normal-case placeholder:text-muted",
            error ? "border-danger" : "border-line",
          )}
        />
        <button
          type="button"
          onClick={onApply}
          disabled={!input.trim()}
          className="h-11 shrink-0 rounded-full border-2 border-line bg-card px-section text-md font-semibold text-fg transition-transform duration-quick active:scale-[0.98] disabled:opacity-50"
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

export type PayChoice = "full" | "half" | "minimum";

/** How much of the total the customer pays now: Full, Half or Minimum.
 *
 *  Each choice is its own tile, with the amount under the word, so a cashier who
 *  does not read the word reads the money. The chosen tile is the till's one
 *  look for "chosen": solid orange, white, a tick, the same as a chosen payment
 *  method. */
export function HowMuchNow({
  options,
  value,
  onChange,
  currency,
}: {
  options: { id: PayChoice; label: string; amount: number }[];
  value: PayChoice;
  onChange: (c: PayChoice) => void;
  currency: string;
}) {
  const t = useTranslations("pos");
  return (
    <TileGrid cols={options.length >= 3 ? 3 : 2} role="radiogroup" aria-label={t("pay.howMuch")}>
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
          className="h-[4.25rem]"
        />
      ))}
    </TileGrid>
  );
}

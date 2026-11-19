"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Banknote, ChevronRight, CreditCard, QrCode, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import { PageShell, Radio, Select, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getPaymentSettings, updatePaymentSettings } from "@/lib/api";
import type { PaymentSettings, PayoutSchedule, TillMethod } from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay, formatMoney } from "@/lib/format";
import { PaymentAccounts } from "./_components/PaymentAccounts";
import { PayoutBank } from "./_components/PayoutBank";
import { IconTile, SaveBar, SectionSkeleton, SettingRow, SettingsSection, SuffixInput, Switch } from "../_components/SettingsKit";

const METHOD_ICON: Record<TillMethod, LucideIcon> = { cash: Wallet, bkash: Smartphone, bangla_qr: QrCode, card_terminal: CreditCard, cashapp: QrCode };

const SCHEDULES: PayoutSchedule[] = ["daily", "weekly", "monthly"];

const arrow =
  "inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

interface Form {
  schedule: PayoutSchedule;
  day: number;
  float: string;
  tolerance: string;
}

const taka = (minor: number) => (minor / 100).toFixed(minor % 100 ? 2 : 0);

const toForm = (p: PaymentSettings): Form => ({
  schedule: p.payoutSchedule,
  day: p.payoutDay,
  float: taka(p.defaultFloat),
  tolerance: taka(p.countTolerance),
});

/** Money as typed — "1,500", "12.50" — in minor units, or null. */
function parseAmount(raw: string): number | null {
  const s = raw.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The next day money is paid out on this schedule, counting from tomorrow. */
function nextPayout(schedule: PayoutSchedule, day: number): string {
  const d = new Date(`${DEMO_TODAY}T12:00:00`);
  d.setDate(d.getDate() + 1);
  if (schedule === "weekly") while (d.getDay() !== day) d.setDate(d.getDate() + 1);
  if (schedule === "monthly") while (d.getDate() !== day) d.setDate(d.getDate() + 1);
  return isoOf(d);
}

function currencySymbol(currency: string, locale: string): string {
  try {
    // narrowSymbol: English formatting names the taka "BDT", which is a code a
    // cashier reads rather than the ৳ printed on every receipt.
    return (
      new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")
        ?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/**
 * Payments — how customers pay, where the money goes, and how the drawer counts.
 *
 * It was two sections: provider accounts with a solid orange "Connect" on every
 * row that was not connected, and advance rules whose amount field rewrote
 * itself as you typed, so "12." lost its decimal point. Payment settings worth
 * copying — Square's payment types, Stripe's account states, Shopify's payout
 * schedule, Toast's cash handling — cover more, and each part here answers one
 * question a manager actually has:
 *
 *  • Which buttons does a cashier see, and in what order? — a list, acted on at
 *    once with Undo, with the payment step drawn as the till draws it.
 *  • Is each account taking money, and if not, what is missing? — said in words
 *    under the status, not only as a pill.
 *  • How much can a booking be held on? When is money paid out? How close must
 *    a cash count be? — one form, one save bar.
 *
 * Turning an account off asks first: the till stops offering it mid-shift.
 */
export default function PaymentsPage() {
  const t = useTranslations("moneysetup");
  const ts = useTranslations("settings");
  const locale = useLocale();
  const toast = useToast();

  const settingsQ = useApiQuery(() => getPaymentSettings(), []);
  const opQ = useApiQuery(() => getOperator(), []);

  // The list as last written, so a switch or an arrow moves under the finger.
  const [methods, setMethods] = useState<PaymentSettings["methods"] | null>(null);
  const [base, setBase] = useState<Form | null>(null);
  const [draft, setDraft] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  /* Counterfoil's account is always there to take a payment, so a till method
     never waits on the tenant connecting one of their own. */
  const nonCashOk = true;
  const currency = opQ.data?.currency ?? "BDT";
  const symbol = currencySymbol(currency, locale);

  const list = methods ?? settingsQ.data?.methods ?? null;
  const saved = base ?? (settingsQ.data ? toForm(settingsQ.data) : null);
  const form = draft ?? saved;
  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  if (!list || !form || !saved) {
    return (
      <PageShell title={t("title")} description={t("description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const set = (patch: Partial<Form>) => setDraft({ ...form, ...patch });

  // ── methods: immediate, with Undo ──────────────────────────────────────────
  const writeMethods = async (next: PaymentSettings["methods"], undo?: { to: PaymentSettings["methods"]; message: string }) => {
    const before = list;
    setMethods(next);
    const res = await updatePaymentSettings({ methods: next });
    if (!res.ok) {
      setMethods(before);
      toast.error(res.error.message);
      return;
    }
    setMethods(res.data.methods);
    if (undo) toast.success(undo.message, { label: ts("common.undo"), run: () => void writeMethods(undo.to) });
  };
  const toggle = (i: number, on: boolean) => {
    const name = t(`methods.${list[i].method}.name`);
    writeMethods(
      list.map((m, j) => (j === i ? { ...m, enabled: on } : m)),
      { to: list, message: on ? t("methods.turnedOn", { method: name }) : t("methods.turnedOff", { method: name }) },
    );
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    writeMethods(next);
  };
  const offered = list.filter((m) => m.method === "cash" || (m.enabled && nonCashOk));

  // ── the form ───────────────────────────────────────────────────────────────
  const floatMinor = parseAmount(form.float);
  const toleranceMinor = parseAmount(form.tolerance);
  const floatErr = floatMinor === null ? t("cash.invalid") : undefined;
  const toleranceErr = toleranceMinor === null ? t("cash.invalid") : undefined;
  const invalid = !!(floatErr || toleranceErr);

  const save = async () => {
    if (invalid || floatMinor === null || toleranceMinor === null) return;
    setSaving(true);
    const ps = await updatePaymentSettings({ payoutSchedule: form.schedule, payoutDay: form.day, defaultFloat: floatMinor, countTolerance: toleranceMinor });
    setSaving(false);
    if (!ps.ok) {
      toast.error(ps.error.message ?? ts("save.invalid"));
      return;
    }
    setBase(toForm(ps.data));
    setDraft(null);
    toast.success(t("saved"));
  };

  const weekdays = Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2026, 6, 26 + d, 12)),
  );

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section pb-hero">
        <SettingsSection title={t("methods.title")} description={t("methods.description")}>
          <ul className="divide-y divide-hairline">
            {list.map((m, i) => {
              const name = t(`methods.${m.method}.name`);
              const isCash = m.method === "cash";
              const hidden = !isCash && m.enabled && !nonCashOk;
              return (
                <li key={m.method} className="flex items-center gap-tight px-card py-comfortable">
                  <div className="flex shrink-0">
                    <button type="button" aria-label={t("methods.moveUp", { method: name })} disabled={i === 0} onClick={() => move(i, -1)} className={arrow}>
                      <ArrowUp size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("methods.moveDown", { method: name })}
                      disabled={i === list.length - 1}
                      onClick={() => move(i, 1)}
                      className={arrow}
                    >
                      <ArrowDown size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
                  <span className="hidden sm:flex">
                    <IconTile icon={METHOD_ICON[m.method]} />
                  </span>
                  <div className="min-w-0 flex-1 pl-tight">
                    <p className="text-base font-medium text-fg">{name}</p>
                    <p className={cn("mt-inline text-sm leading-relaxed", hidden ? "text-warning" : "text-muted")}>
                      {isCash ? t("methods.cashLocked") : hidden ? t("methods.needsAccount") : t(`methods.${m.method}.desc`)}
                    </p>
                    {/* On a phone the words have no room beside a sentence; they
                        take their own line under it. */}
                    {isCash && <p className="mt-inline text-sm font-medium text-fg sm:hidden">{t("methods.alwaysOn")}</p>}
                  </div>
                  {/* Cash says so in words: a greyed-out switch that can never be
                      moved reads as broken, not as a rule. */}
                  {isCash ? (
                    <span className="hidden h-11 shrink-0 items-center whitespace-nowrap pl-comfortable text-sm font-medium text-muted sm:inline-flex">
                      {t("methods.alwaysOn")}
                    </span>
                  ) : (
                    <Switch checked={m.enabled} onChange={(on) => toggle(i, on)} label={t("methods.switch", { method: name })} />
                  )}
                </li>
              );
            })}
          </ul>
          {/* The payment step as the till draws it, in the order above. A list
              of switches says what is allowed; this says what a cashier sees. */}
          <div className="px-card py-section">
            <p className="text-base font-medium text-fg">{t("methods.previewLabel")}</p>
            <p className="mt-inline text-sm text-muted">{t("methods.previewNote")}</p>
            <p className="sr-only">{offered.map((m) => t(`methods.${m.method}.name`)).join(", ")}</p>
            <div aria-hidden className="mt-comfortable inline-flex max-w-full flex-wrap gap-inline rounded-control bg-muted-wash p-inline">
              {offered.map((m, i) => {
                const Icon = METHOD_ICON[m.method];
                return (
                  <span
                    key={m.method}
                    className={cn(
                      // A frame inside the 6px track takes the next step down.
                      "inline-flex min-h-9 items-center gap-tight rounded-inner px-comfortable text-sm font-medium",
                      i === 0 ? "bg-card text-fg shadow-sm" : "text-muted",
                    )}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    {t(`methods.${m.method}.name`)}
                  </span>
                );
              })}
            </div>
          </div>
        </SettingsSection>

        {/* Whose account online payments go into — and so which way the fee
            runs — then where Counterfoil sends what it owes. */}
        <PaymentAccounts />
        <PayoutBank />

        <Link
          href="/settings/payment-choices"
          className="card-surface flex min-h-14 items-center gap-comfortable px-card py-comfortable transition-colors duration-quick hover:bg-muted-wash"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium text-fg">{t("payNow.link.title")}</span>
            <span className="mt-inline block text-sm leading-relaxed text-muted">{t("payNow.link.desc")}</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
        </Link>

        <SettingsSection title={t("payouts.title")} description={t("payouts.description")}>
          <div role="radiogroup" aria-label={t("payouts.schedule")} className="grid gap-tight px-card py-section sm:grid-cols-3">
            {SCHEDULES.map((s) => {
              const checked = form.schedule === s;
              return (
                // The tile is the target; the kit Radio inside is the control, so
                // a click on the padding picks it too.
                <div
                  key={s}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("label,input")) return;
                    set({ schedule: s, day: s === "monthly" ? 1 : 0 });
                  }}
                  className={cn(
                    // One step down from the card: a frame set inside another
                    // frame takes the next radius on the scale.
                    "cursor-pointer rounded-control px-tight transition-colors duration-quick",
                    checked ? "bg-ember-wash ring-2 ring-inset ring-ember-solid" : "bg-muted-wash hover:bg-line",
                  )}
                >
                  <Radio
                    name="payout-schedule"
                    value={s}
                    checked={checked}
                    onChange={() => set({ schedule: s, day: s === "monthly" ? 1 : 0 })}
                    label={<span className="font-medium">{t(`payouts.${s}`)}</span>}
                    description={t(`payouts.${s}Desc`)}
                  />
                </div>
              );
            })}
          </div>
          {form.schedule !== "daily" && (
            <SettingRow label={form.schedule === "weekly" ? t("payouts.weekday") : t("payouts.monthDay")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={String(form.day)}
                  onChange={(v) => set({ day: Number(v) })}
                  options={
                    form.schedule === "weekly"
                      ? weekdays.map((name, d) => ({ value: String(d), label: name }))
                      : Array.from({ length: 28 }, (_, i) => i + 1).map((d) => ({
                          value: String(d),
                          label: t("payouts.dayOfMonth", { day: d }),
                        }))
                  }
                />
              )}
            </SettingRow>
          )}
          <p className="px-card py-section text-sm leading-relaxed text-muted">
            <span className="font-medium text-fg">{t("payouts.next", { date: formatDay(nextPayout(form.schedule, form.day), { weekday: true }) })}</span>{" "}
            {t("payouts.note")}
          </p>
        </SettingsSection>

        <SettingsSection title={t("cash.title")} description={t("cash.description")}>
          <SettingRow icon={Banknote} label={t("cash.float")} description={t("cash.floatDesc")} error={floatErr}>
            {({ id, describedBy }) => (
              <SuffixInput id={id} value={form.float} onChange={(v) => set({ float: v })} suffix={symbol} invalid={!!floatErr} describedBy={describedBy} />
            )}
          </SettingRow>
          <SettingRow
            label={t("cash.tolerance")}
            description={
              <>
                {t("cash.toleranceDesc")}
                {toleranceMinor !== null && toleranceMinor > 0 && (
                  <span className="mt-inline block">
                    {t("cash.example", {
                      near: formatMoney(Math.round(toleranceMinor / 2), currency),
                      far: formatMoney(toleranceMinor * 2, currency),
                    })}
                  </span>
                )}
              </>
            }
            error={toleranceErr}
          >
            {({ id, describedBy }) => (
              <SuffixInput
                id={id}
                value={form.tolerance}
                onChange={(v) => set({ tolerance: v })}
                suffix={symbol}
                invalid={!!toleranceErr}
                describedBy={describedBy}
              />
            )}
          </SettingRow>
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={save} onDiscard={() => setDraft(null)} />
      </div>

    </PageShell>
  );
}

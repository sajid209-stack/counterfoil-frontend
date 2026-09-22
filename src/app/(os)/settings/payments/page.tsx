"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, CircleAlert, CreditCard, Landmark, QrCode, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import { Button, ConfirmDialog, PageShell, StatusPill, useToast, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  activatePaymentAccount,
  createAccountLink,
  createPaymentAccount,
  disablePaymentAccount,
  getAdvancePolicy,
  getOperator,
  getPaymentSettings,
  listPaymentAccounts,
  updateAdvancePolicy,
  updatePaymentSettings,
} from "@/lib/api";
import type {
  AdvancePolicy,
  AdvanceRule,
  PaymentAccount,
  PaymentAccountStatus,
  PaymentProvider,
  PaymentSettings,
  PayoutSchedule,
  TillMethod,
} from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay, formatMoney } from "@/lib/format";
import { IconTile, SaveBar, SectionSkeleton, SettingRow, SettingsSection, SuffixInput, Switch, controlCls } from "../_components/SettingsKit";

const PROVIDERS: { provider: PaymentProvider; posture: PaymentAccount["posture"]; icon: LucideIcon }[] = [
  { provider: "bkash", posture: "merchant_of_record", icon: Smartphone },
  { provider: "sslcommerz", posture: "merchant_of_record", icon: Landmark },
  { provider: "stripe", posture: "connect", icon: CreditCard },
];

const METHOD_ICON: Record<TillMethod, LucideIcon> = { cash: Wallet, bkash: Smartphone, bangla_qr: QrCode, card_terminal: CreditCard };

const STATUS_TONE: Record<PaymentAccountStatus, PillTone> = {
  active: "success",
  pending_onboarding: "warning",
  restricted: "warning",
  disabled: "neutral",
};

const SCHEDULES: PayoutSchedule[] = ["daily", "weekly", "monthly"];

/** A ৳2,000 booking — round enough to check an advance in your head. */
const SAMPLE = 200_000;

const arrow =
  "inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

interface RuleDraft {
  enabled: boolean;
  kind: AdvanceRule["minKind"];
  value: string;
}

interface Form {
  counter: RuleDraft;
  online: RuleDraft;
  schedule: PayoutSchedule;
  day: number;
  float: string;
  tolerance: string;
}

const taka = (minor: number) => (minor / 100).toFixed(minor % 100 ? 2 : 0);

const toRule = (r: AdvanceRule): RuleDraft => ({
  enabled: r.enabled,
  kind: r.minKind,
  value: r.minKind === "percent" ? String(r.minValue) : taka(r.minValue),
});

const toForm = (a: AdvancePolicy, p: PaymentSettings): Form => ({
  counter: toRule(a.counter),
  online: toRule(a.online),
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

/** The least taken up front: a whole percentage from 1 to 100, or an amount above zero. */
function parseRule(d: RuleDraft): number | null {
  if (d.kind === "percent") {
    const s = d.value.trim();
    const n = Number(s);
    return /^\d{1,3}$/.test(s) && n >= 1 && n <= 100 ? n : null;
  }
  const a = parseAmount(d.value);
  return a !== null && a > 0 ? a : null;
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

  const accountsQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const advanceQ = useApiQuery(() => getAdvancePolicy(), []);
  const settingsQ = useApiQuery(() => getPaymentSettings(), []);
  const opQ = useApiQuery(() => getOperator(), []);

  const [busy, setBusy] = useState<string | null>(null);
  const [turningOff, setTurningOff] = useState<PaymentAccount | null>(null);
  // The list as last written, so a switch or an arrow moves under the finger.
  const [methods, setMethods] = useState<PaymentSettings["methods"] | null>(null);
  const [base, setBase] = useState<Form | null>(null);
  const [draft, setDraft] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const accounts = accountsQ.data?.data ?? [];
  const byProvider = (p: PaymentProvider) => accounts.find((a) => a.provider === p);
  const nonCashOk = accounts.some((a) => a.status === "active" && a.chargesEnabled);
  const currency = opQ.data?.currency ?? "BDT";
  const symbol = currencySymbol(currency, locale);

  const list = methods ?? settingsQ.data?.methods ?? null;
  const saved = base ?? (advanceQ.data && settingsQ.data ? toForm(advanceQ.data, settingsQ.data) : null);
  const form = draft ?? saved;
  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  if (!list || !form || !saved || !accountsQ.data) {
    return (
      <PageShell title={t("title")} description={t("description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const set = (patch: Partial<Form>) => setDraft({ ...form, ...patch });
  const setRule = (ch: "counter" | "online", patch: Partial<RuleDraft>) => set({ [ch]: { ...form[ch], ...patch } });

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

  // ── accounts: immediate ────────────────────────────────────────────────────
  const connect = async (provider: PaymentProvider, posture: PaymentAccount["posture"]) => {
    setBusy(provider);
    const created = await createPaymentAccount({ provider, posture, locationId: null, country: "BD", defaultCurrency: "BDT" });
    if (created.ok) await createAccountLink(created.data.id);
    setBusy(null);
    toast.info(t("accounts.linkOpened"));
    accountsQ.reload();
  };
  const activate = async (acct: PaymentAccount) => {
    setBusy(acct.provider);
    await activatePaymentAccount(acct.id);
    setBusy(null);
    toast.success(t("accounts.activated", { provider: t(`provider.${acct.provider}`) }));
    accountsQ.reload();
  };
  const turnOff = async (acct: PaymentAccount) => {
    setTurningOff(null);
    setBusy(acct.provider);
    await disablePaymentAccount(acct.id);
    setBusy(null);
    toast.success(t("accounts.disabledToast", { provider: t(`provider.${acct.provider}`) }));
    accountsQ.reload();
  };

  // ── the form ───────────────────────────────────────────────────────────────
  const ruleErr = (ch: "counter" | "online") =>
    form[ch].enabled && parseRule(form[ch]) === null
      ? form[ch].kind === "percent"
        ? t("advance.invalidPercent")
        : t("advance.invalidAmount")
      : undefined;
  const floatMinor = parseAmount(form.float);
  const toleranceMinor = parseAmount(form.tolerance);
  const floatErr = floatMinor === null ? t("cash.invalid") : undefined;
  const toleranceErr = toleranceMinor === null ? t("cash.invalid") : undefined;
  const invalid = !!(ruleErr("counter") || ruleErr("online") || floatErr || toleranceErr);

  const save = async () => {
    if (invalid || floatMinor === null || toleranceMinor === null || !advanceQ.data) return;
    setSaving(true);
    const rule = (ch: "counter" | "online"): AdvanceRule => ({
      enabled: form[ch].enabled,
      minKind: form[ch].kind,
      // A switched-off rule keeps the last minimum that made sense.
      minValue: parseRule(form[ch]) ?? advanceQ.data![ch].minValue,
    });
    const [adv, ps] = await Promise.all([
      updateAdvancePolicy({ counter: rule("counter"), online: rule("online") }),
      updatePaymentSettings({ payoutSchedule: form.schedule, payoutDay: form.day, defaultFloat: floatMinor, countTolerance: toleranceMinor }),
    ]);
    setSaving(false);
    if (!adv.ok || !ps.ok) {
      toast.error((!adv.ok ? adv.error : !ps.ok ? ps.error : null)?.message ?? ts("save.invalid"));
      return;
    }
    setBase(toForm(adv.data, ps.data));
    setDraft(null);
    toast.success(t("saved"));
  };

  const weekdays = Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2026, 6, 26 + d, 12)),
  );

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
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
                    <p className="text-sm font-medium text-fg">{name}</p>
                    <p className={cn("mt-inline text-[13px] leading-relaxed", hidden ? "text-warning" : "text-muted")}>
                      {isCash ? t("methods.cashLocked") : hidden ? t("methods.needsAccount") : t(`methods.${m.method}.desc`)}
                    </p>
                  </div>
                  {/* Cash says so in words: a greyed-out switch that can never be
                      moved reads as broken, not as a rule. */}
                  {isCash ? (
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-end text-[12px] font-medium text-muted">
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
            <p className="text-sm font-medium text-fg">{t("methods.previewLabel")}</p>
            <p className="mt-inline text-[13px] text-muted">{t("methods.previewNote")}</p>
            <p className="sr-only">{offered.map((m) => t(`methods.${m.method}.name`)).join(", ")}</p>
            <div aria-hidden className="mt-comfortable inline-flex max-w-full flex-wrap gap-inline rounded-sm bg-subtle/60 p-inline ring-1 ring-inset ring-hairline">
              {offered.map((m, i) => {
                const Icon = METHOD_ICON[m.method];
                return (
                  <span
                    key={m.method}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-tight rounded-xs px-comfortable text-[13px] font-medium",
                      i === 0 ? "bg-card text-fg shadow-sm ring-1 ring-inset ring-hairline" : "text-muted",
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

        <SettingsSection title={t("accounts.title")} description={t("accounts.description")}>
          {PROVIDERS.map(({ provider, posture, icon }) => {
            const acct = byProvider(provider);
            const isBusy = busy === provider;
            const items = (acct?.requirementsDue ?? []).map((r) => t(`requirement.${r}`)).join(", ");
            const needsWork = !!acct && (acct.status === "pending_onboarding" || acct.status === "restricted");
            return (
              <div key={provider} className="flex flex-col gap-section px-card py-section sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-section">
                  <IconTile icon={icon} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-tight">
                      <p className="text-sm font-medium text-fg">{t(`provider.${provider}`)}</p>
                      {acct ? (
                        <StatusPill tone={STATUS_TONE[acct.status]}>{t(`status.${acct.status}`)}</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">{t("accounts.notConnected")}</StatusPill>
                      )}
                    </div>
                    <p className={cn("mt-inline flex items-start gap-inline text-[13px] leading-relaxed", needsWork ? "text-warning" : "text-muted")}>
                      {needsWork && <CircleAlert size={14} strokeWidth={1.5} aria-hidden className="mt-[3px] shrink-0" />}
                      <span>{acct ? t(`accounts.state.${acct.status}`, { items }) : t(`provider.${provider}Helper`)}</span>
                    </p>
                    <p className="mt-inline text-[13px] text-muted">{t(`posture.${posture}`)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-tight sm:justify-end">
                  {!acct ? (
                    <Button variant="secondary" loading={isBusy} onClick={() => connect(provider, posture)}>
                      {t("accounts.connect")}
                    </Button>
                  ) : acct.status === "active" ? (
                    <Button variant="secondary" loading={isBusy} onClick={() => setTurningOff(acct)}>
                      {t("accounts.turnOff")}
                    </Button>
                  ) : acct.status === "disabled" ? (
                    <Button variant="secondary" loading={isBusy} onClick={() => activate(acct)}>
                      {t("accounts.turnOn")}
                    </Button>
                  ) : (
                    <Button loading={isBusy} onClick={() => activate(acct)}>
                      {t("accounts.finish")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </SettingsSection>

        <SettingsSection title={t("advance.title")} description={t("advance.description")}>
          {(["counter", "online"] as const).map((ch) => {
            const r = form[ch];
            const err = ruleErr(ch);
            const min = parseRule(r);
            const minMinor = min === null ? null : r.kind === "percent" ? Math.round((SAMPLE * min) / 100) : Math.min(min, SAMPLE);
            return (
              <div key={ch} className="divide-y divide-hairline">
                <SettingRow label={t(`advance.${ch}`)} description={t(`advance.${ch}Help`)} labelFor={false}>
                  {({ labelId, describedBy }) => (
                    <div className="flex sm:justify-end">
                      <Switch checked={r.enabled} onChange={(on) => setRule(ch, { enabled: on })} labelledBy={labelId} describedBy={describedBy} />
                    </div>
                  )}
                </SettingRow>
                {r.enabled && (
                  <SettingRow
                    label={t("advance.least")}
                    description={
                      minMinor !== null
                        ? t("advance.example", { total: formatMoney(SAMPLE, currency), min: formatMoney(minMinor, currency) })
                        : t("advance.minHelp")
                    }
                    error={err}
                  >
                    {({ id, describedBy }) => (
                      <div className="flex gap-tight">
                        <div role="radiogroup" aria-label={t("advance.minKind")} className="inline-flex shrink-0 rounded-sm border border-line bg-card p-[3px]">
                          {(["percent", "amount"] as const).map((k) => (
                            <label
                              key={k}
                              className={cn(
                                "inline-flex min-h-[2.375rem] min-w-10 cursor-pointer items-center justify-center rounded-xs px-comfortable text-sm font-medium transition-colors duration-quick has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember",
                                r.kind === k ? "bg-ember-solid text-white" : "text-muted hover:text-fg",
                              )}
                            >
                              <input
                                type="radio"
                                name={`advance-kind-${ch}`}
                                value={k}
                                checked={r.kind === k}
                                aria-label={k === "percent" ? t("advance.percentOfTotal") : t("advance.fixedAmount")}
                                // Switching kind offers a sensible starting figure
                                // rather than an empty field already in error.
                                onChange={() => setRule(ch, { kind: k, value: k === "percent" ? "25" : "500" })}
                                className="sr-only"
                              />
                              {k === "percent" ? "%" : symbol}
                            </label>
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <SuffixInput
                            id={id}
                            value={r.value}
                            onChange={(v) => setRule(ch, { value: v })}
                            suffix={r.kind === "percent" ? "%" : symbol}
                            invalid={!!err}
                            describedBy={describedBy}
                            inputMode={r.kind === "percent" ? "numeric" : "decimal"}
                          />
                        </div>
                      </div>
                    )}
                  </SettingRow>
                )}
              </div>
            );
          })}
          <div className="flex flex-col gap-tight px-card py-section sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] leading-relaxed text-muted">{t("advance.policiesNote")}</p>
            <Link
              href="/catalog?kind=bookings"
              className="inline-flex min-h-11 shrink-0 items-center self-start rounded-sm text-[13px] font-medium text-fg underline-offset-2 hover:underline sm:self-center md:min-h-9"
            >
              {t("advance.policiesLink")}
            </Link>
          </div>
        </SettingsSection>

        <SettingsSection title={t("payouts.title")} description={t("payouts.description")}>
          <div role="radiogroup" aria-label={t("payouts.schedule")} className="grid gap-tight px-card py-section sm:grid-cols-3">
            {SCHEDULES.map((s) => {
              const checked = form.schedule === s;
              return (
                <label
                  key={s}
                  className={cn(
                    "flex cursor-pointer items-start gap-comfortable rounded-md border p-comfortable transition-colors duration-quick",
                    checked ? "border-ember-solid bg-ember/5" : "border-line hover:bg-subtle/60",
                  )}
                >
                  <input
                    type="radio"
                    name="payout-schedule"
                    value={s}
                    checked={checked}
                    onChange={() => set({ schedule: s, day: s === "monthly" ? 1 : 0 })}
                    className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{t(`payouts.${s}`)}</span>
                    <span className="mt-inline block text-[13px] leading-relaxed text-muted">{t(`payouts.${s}Desc`)}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {form.schedule !== "daily" && (
            <SettingRow label={form.schedule === "weekly" ? t("payouts.weekday") : t("payouts.monthDay")}>
              {({ id }) => (
                <select id={id} value={form.day} onChange={(e) => set({ day: Number(e.target.value) })} className={cn(controlCls(), "pr-section")}>
                  {form.schedule === "weekly"
                    ? weekdays.map((name, d) => (
                        <option key={d} value={d}>
                          {name}
                        </option>
                      ))
                    : Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {t("payouts.dayOfMonth", { day: d })}
                        </option>
                      ))}
                </select>
              )}
            </SettingRow>
          )}
          <p className="px-card py-section text-[13px] leading-relaxed text-muted">
            <span className="font-medium text-fg">{t("payouts.next", { date: formatDay(nextPayout(form.schedule, form.day), { weekday: true }) })}</span>{" "}
            {t("payouts.note")}
          </p>
        </SettingsSection>

        <SettingsSection title={t("cash.title")} description={t("cash.description")}>
          <SettingRow label={t("cash.float")} description={t("cash.floatDesc")} error={floatErr}>
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

      <ConfirmDialog
        open={!!turningOff}
        onClose={() => setTurningOff(null)}
        onConfirm={() => {
          if (turningOff) void turnOff(turningOff);
        }}
        title={turningOff ? t("accounts.turnOffTitle", { provider: t(`provider.${turningOff.provider}`) }) : ""}
        message={t("accounts.turnOffBody")}
        confirmLabel={t("accounts.turnOff")}
      />
    </PageShell>
  );
}

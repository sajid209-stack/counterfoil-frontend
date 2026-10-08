"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Modal, StatusPill, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { describeDestination, getPayoutDestination, setPayoutDestination, type PayoutDestinationInput } from "@/lib/api";
import { SettingsSection, controlCls } from "../../_components/SettingsKit";

const EMPTY: PayoutDestinationInput = { kind: "bank", bankName: "", branch: "", accountName: "", accountNumber: "", routingNumber: "" };

/**
 * Where Counterfoil sends what it owes — a bank account or a bKash merchant
 * number. Shown masked, with whether it has been verified, because new details
 * are checked before money goes to them and a payout waiting on that should
 * say why.
 */
export function PayoutBank() {
  const t = useTranslations("money");
  const tc = useTranslations("common");
  const toast = useToast();
  const q = useApiQuery(() => getPayoutDestination(), []);
  const [form, setForm] = useState<PayoutDestinationInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const d = q.data;

  const save = async () => {
    if (!form) return;
    setBusy(true);
    const res = await setPayoutDestination(form);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.error.fieldErrors ?? {});
      return;
    }
    setForm(null);
    toast.success(t("settings.bankSaved"));
    q.reload();
  };

  const field = (key: keyof PayoutDestinationInput, label: string, opts: { mono?: boolean; inputMode?: "numeric" | "text" } = {}) => (
    <div>
      <label htmlFor={`bank-${key}`} className="text-[13px] font-medium text-fg">{label}</label>
      <input
        id={`bank-${key}`}
        value={(form?.[key] as string) ?? ""}
        onChange={(e) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f))}
        inputMode={opts.inputMode}
        autoComplete="off"
        aria-invalid={!!errors[key] || undefined}
        className={cn(controlCls(!!errors[key]), "mt-inline", opts.mono && "font-mono")}
      />
      {errors[key] && <p className="mt-inline text-[13px] text-danger">{errors[key]}</p>}
    </div>
  );

  return (
    <div id="bank" className="scroll-mt-24">
      <SettingsSection
        title={t("settings.bankTitle")}
        description={t("settings.bankDesc")}
        aside={
          <Button variant="secondary" onClick={() => { setErrors({}); setForm({ ...EMPTY, kind: d?.kind ?? "bank" }); }}>
            {d ? t("settings.bankEdit") : t("settings.bankAdd")}
          </Button>
        }
      >
        <div className="px-card pb-card">
          {d === undefined ? (
            <div className="h-10 animate-pulse rounded-sm bg-line/50" />
          ) : d === null ? (
            <p className="text-[13px] font-medium text-warning">{t("settings.bankNone")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-comfortable">
              <div className="min-w-0">
                <p className="font-mono text-sm text-fg">{describeDestination(d)}</p>
                <p className="mt-inline text-[13px] text-muted">
                  {d.accountName}
                  {d.branch ? ` · ${d.branch}` : ""}
                  {d.routingNumber ? ` · ${d.routingNumber}` : ""}
                </p>
              </div>
              <StatusPill tone={d.status === "verified" ? "success" : "warning"}>
                {d.status === "verified" ? t("settings.bankVerified") : t("settings.bankPending")}
              </StatusPill>
            </div>
          )}
          <p className="mt-comfortable text-[12px] text-muted">{t("settings.adminOnly")}</p>
        </div>
      </SettingsSection>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={t("settings.bankTitle")}
        description={t("settings.bankDesc")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>{tc("cancel")}</Button>
            <Button loading={busy} onClick={save}>{t("settings.bankSave")}</Button>
          </>
        }
      >
        {form && (
          <form className="flex flex-col gap-comfortable" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <div role="radiogroup" aria-label={t("settings.bankKind")} className="inline-flex self-start rounded-sm border border-line bg-card p-[3px]">
              {(["bank", "bkash"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={form.kind === k}
                  onClick={() => { setErrors({}); setForm({ ...form, kind: k }); }}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-xs px-comfortable text-[13px] font-medium transition-colors duration-quick md:min-h-9",
                    form.kind === k ? "bg-ember-solid text-white" : "text-muted hover:text-fg",
                  )}
                >
                  {k === "bank" ? t("settings.bankKindBank") : t("settings.bankKindBkash")}
                </button>
              ))}
            </div>
            {form.kind === "bank" && (
              <div className="grid gap-comfortable sm:grid-cols-2">
                {field("bankName", t("settings.bankName"))}
                {field("branch", t("settings.bankBranch"))}
              </div>
            )}
            {field("accountName", t("settings.bankAccountName"))}
            {field("accountNumber", form.kind === "bank" ? t("settings.bankAccountNumber") : t("settings.bkashNumber"), { mono: true, inputMode: "numeric" })}
            {form.kind === "bank" && field("routingNumber", t("settings.bankRouting"), { mono: true, inputMode: "numeric" })}
            <button type="submit" tabIndex={-1} aria-hidden className="sr-only">{t("settings.bankSave")}</button>
          </form>
        )}
      </Modal>
    </div>
  );
}

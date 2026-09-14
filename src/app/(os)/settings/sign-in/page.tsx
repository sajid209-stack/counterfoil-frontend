"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getAccessPolicy, listRoles, listStaff, updateAccessPolicy, type AccessPolicy, type TwoStepRequirement } from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch, controlCls } from "../_components/SettingsKit";
import { isElevated } from "../_lib/access";

const TWO_STEP: TwoStepRequirement[] = ["off", "managers", "everyone"];
const SESSION_HOURS = [1, 8, 12, 24, 168, 720];
const TILL_LOCK: (number | null)[] = [1, 2, 5, 10, 15, null];
const PIN_LENGTHS = [4, 6];
const PIN_ATTEMPTS = [3, 5, 10];

/**
 * Sign-in rules — the business's, not the person's.
 *
 * Security holds your own password and your own two-step. What was missing is
 * the layer every team product puts above that: whether two-step is required
 * and of whom, how long a sign-in lasts before it asks again, how quickly an
 * unattended till locks itself, and how a PIN is guarded. At a counter those
 * are not abstractions — a till left signed in during a rush is how somebody
 * else rings up a refund.
 *
 * The two-step choice counts the people it reaches, because "required for
 * managers" means nothing until it says it is four people, and making a rule
 * stricter says what happens to those who have not set it up yet.
 */
export default function SignInRulesPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const polQ = useApiQuery(() => getAccessPolicy(), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const roleQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);

  const [base, setBase] = useState<AccessPolicy | null>(null);
  const [draft, setDraft] = useState<AccessPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = base ?? polQ.data ?? null;
  const form = draft ?? saved;
  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  if (form === null || saved === null) {
    return (
      <PageShell title={t("signIn.title")} description={t("signIn.description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const roles = roleQ.data?.data ?? [];
  // Suspended people cannot sign in, so a rule does not reach them.
  const people = (staffQ.data?.data ?? []).filter((s) => s.status !== "suspended");
  const elevated = roles.filter((r) => isElevated(r));
  const reach: Record<TwoStepRequirement, number> = {
    off: 0,
    managers: people.filter((s) => elevated.some((r) => r.id === s.roleId)).length,
    everyone: people.length,
  };
  const stricter = TWO_STEP.indexOf(form.twoStep) > TWO_STEP.indexOf(saved.twoStep);

  const set = (patch: Partial<AccessPolicy>) => setDraft({ ...form, ...patch });
  const span = (hours: number) => (hours < 24 ? t("signIn.hours", { count: hours }) : t("signIn.days", { count: hours / 24 }));

  const save = async () => {
    setSaving(true);
    const res = await updateAccessPolicy(form);
    setSaving(false);
    if (res.ok) {
      setBase(res.data);
      setDraft(null);
      toast.success(t("signIn.saved"));
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <PageShell title={t("signIn.title")} description={t("signIn.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("signIn.twoStepTitle")} description={t("signIn.twoStepDesc")}>
          <div role="radiogroup" aria-label={t("signIn.twoStepTitle")} className="flex flex-col gap-tight px-major py-section">
            {TWO_STEP.map((level) => {
              const checked = form.twoStep === level;
              return (
                <label
                  key={level}
                  className={cn(
                    "flex cursor-pointer items-start gap-comfortable rounded-md border px-section py-comfortable transition-colors duration-quick",
                    checked ? "border-ember-solid bg-ember/5" : "border-line hover:bg-subtle/60",
                  )}
                >
                  <input
                    type="radio"
                    name="two-step"
                    value={level}
                    checked={checked}
                    onChange={() => set({ twoStep: level })}
                    className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-section gap-y-inline">
                      <span className="flex flex-wrap items-center gap-tight">
                        <span className="text-sm font-medium text-fg">{t(`signIn.twoStep.${level}.title`)}</span>
                        {level === "managers" && (
                          <span className="rounded-xs border border-line px-inline text-[12px] font-medium text-muted">
                            {t("signIn.recommended")}
                          </span>
                        )}
                      </span>
                      {level !== "off" && staffQ.data && (
                        <span className="text-[13px] text-muted">{t("signIn.applies", { count: reach[level] })}</span>
                      )}
                    </span>
                    <span className="mt-inline block text-[13px] leading-relaxed text-muted">
                      {t(`signIn.twoStep.${level}.desc`)}
                      {level === "managers" && elevated.length > 0 && (
                        <> {t("signIn.twoStep.managersRoles", { roles: elevated.map((r) => r.name).join(", ") })}</>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
            {stricter && (
              <p role="status" className="mt-tight flex items-start gap-tight text-[13px] leading-relaxed text-muted">
                <Info size={16} strokeWidth={1.5} aria-hidden className="mt-[2px] shrink-0" />
                {t("signIn.stricter")}
              </p>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title={t("signIn.sessionTitle")} description={t("signIn.sessionDesc")}>
          <SettingRow label={t("signIn.sessionHours")} description={t("signIn.sessionHoursDesc")}>
            {({ id, describedBy }) => (
              <select
                id={id}
                value={form.sessionHours}
                onChange={(e) => set({ sessionHours: Number(e.target.value) })}
                aria-describedby={describedBy}
                className={cn(controlCls(), "pr-section")}
              >
                {SESSION_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {span(h)}
                  </option>
                ))}
              </select>
            )}
          </SettingRow>
          <SettingRow
            label={t("signIn.tillLock")}
            description={
              <>
                {t("signIn.tillLockDesc")}
                {form.tillLockMinutes === null && <span className="mt-inline block text-warning">{t("signIn.neverWarn")}</span>}
              </>
            }
          >
            {({ id, describedBy }) => (
              <select
                id={id}
                value={form.tillLockMinutes ?? "never"}
                onChange={(e) => set({ tillLockMinutes: e.target.value === "never" ? null : Number(e.target.value) })}
                aria-describedby={describedBy}
                className={cn(controlCls(), "pr-section")}
              >
                {TILL_LOCK.map((m) => (
                  <option key={m ?? "never"} value={m ?? "never"}>
                    {m === null ? t("signIn.never") : t("signIn.minutes", { count: m })}
                  </option>
                ))}
              </select>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("signIn.pinTitle")} description={t("signIn.pinDesc")}>
          <SettingRow
            label={t("signIn.pinLength")}
            description={
              <>
                {t("signIn.pinLengthDesc")}
                {form.pinLength !== saved.pinLength && (
                  <span className="mt-inline block text-warning">{t("signIn.pinChanged", { count: form.pinLength })}</span>
                )}
              </>
            }
            labelFor={false}
          >
            {({ labelId, describedBy }) => (
              <div className="flex sm:justify-end">
                {/* Real radios under the labels, so arrow keys move between the
                    two lengths the way a keyboard user expects of a choice. */}
                <div
                  role="radiogroup"
                  aria-labelledby={labelId}
                  aria-describedby={describedBy}
                  className="inline-flex rounded-sm border border-line bg-card p-[3px]"
                >
                  {PIN_LENGTHS.map((n) => {
                    const on = form.pinLength === n;
                    return (
                      <label
                        key={n}
                        className={cn(
                          "inline-flex min-h-11 cursor-pointer items-center rounded-xs px-section text-sm font-medium transition-colors duration-quick has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember md:min-h-9",
                          on ? "bg-ember-solid text-white" : "text-muted hover:text-fg",
                        )}
                      >
                        <input
                          type="radio"
                          name="pin-length"
                          value={n}
                          checked={on}
                          onChange={() => set({ pinLength: n })}
                          className="sr-only"
                        />
                        {t("signIn.digits", { count: n })}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </SettingRow>
          <SettingRow label={t("signIn.pinAttempts")} description={t("signIn.pinAttemptsDesc")}>
            {({ id, describedBy }) => (
              <select
                id={id}
                value={form.pinAttempts}
                onChange={(e) => set({ pinAttempts: Number(e.target.value) })}
                aria-describedby={describedBy}
                className={cn(controlCls(), "pr-section")}
              >
                {PIN_ATTEMPTS.map((n) => (
                  <option key={n} value={n}>
                    {t("signIn.tries", { count: n })}
                  </option>
                ))}
              </select>
            )}
          </SettingRow>
          <SettingRow label={t("signIn.deviceBound")} description={t("signIn.deviceBoundDesc")} labelFor={false}>
            {({ labelId, describedBy }) => (
              <div className="flex sm:justify-end">
                <Switch
                  checked={form.deviceBound}
                  onChange={(deviceBound) => set({ deviceBound })}
                  labelledBy={labelId}
                  describedBy={describedBy}
                />
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}

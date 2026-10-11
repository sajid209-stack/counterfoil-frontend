"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Notice, PageShell, RadioGroup, SegmentedControl, Select, StatusPill, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getAccessPolicy, listRoles, listStaff, updateAccessPolicy, type AccessPolicy, type TwoStepRequirement } from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch } from "../_components/SettingsKit";
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
      <div className="flex flex-col gap-section pb-hero">
        <SettingsSection title={t("signIn.twoStepTitle")} description={t("signIn.twoStepDesc")}>
          <div className="flex flex-col gap-tight px-card py-section">
            {/* Radios from the kit, one per level. The label carries the whole
                option — name, the recommended mark, how many people it reaches,
                and what it does — so the sentence stays at supporting-text size
                and the whole block is the click target. */}
            <RadioGroup
              name="two-step"
              aria-label={t("signIn.twoStepTitle")}
              value={form.twoStep}
              onChange={(level) => set({ twoStep: level as TwoStepRequirement })}
              options={TWO_STEP.map((level) => ({
                value: level,
                label: (
                  <>
                    <span className="flex flex-wrap items-baseline gap-x-section gap-y-inline">
                      <span className="flex flex-wrap items-center gap-tight">
                        <span className="text-base font-medium text-fg">{t(`signIn.twoStep.${level}.title`)}</span>
                        {level === "managers" && <StatusPill tone="neutral">{t("signIn.recommended")}</StatusPill>}
                      </span>
                      {level !== "off" && staffQ.data && (
                        <span className="text-sm font-normal tabular-nums text-muted">{t("signIn.applies", { count: reach[level] })}</span>
                      )}
                    </span>
                    <span className="mt-inline block text-sm font-normal leading-relaxed text-muted">
                      {t(`signIn.twoStep.${level}.desc`)}
                      {level === "managers" && elevated.length > 0 && (
                        <> {t("signIn.twoStep.managersRoles", { roles: elevated.map((r) => r.name).join(", ") })}</>
                      )}
                    </span>
                  </>
                ),
              }))}
            />
            {stricter && (
              <Notice tone="info" size="sm" className="mt-tight">
                {t("signIn.stricter")}
              </Notice>
            )}
          </div>
        </SettingsSection>

        <SettingsSection title={t("signIn.sessionTitle")} description={t("signIn.sessionDesc")}>
          <SettingRow label={t("signIn.sessionHours")} description={t("signIn.sessionHoursDesc")}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                value={String(form.sessionHours)}
                onChange={(v) => set({ sessionHours: Number(v) })}
                aria-describedby={describedBy}
                options={SESSION_HOURS.map((h) => ({ value: String(h), label: span(h) }))}
              />
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
              <Select
                id={id}
                value={String(form.tillLockMinutes ?? "never")}
                onChange={(v) => set({ tillLockMinutes: v === "never" ? null : Number(v) })}
                aria-describedby={describedBy}
                options={TILL_LOCK.map((m) => ({
                  value: String(m ?? "never"),
                  label: m === null ? t("signIn.never") : t("signIn.minutes", { count: m }),
                }))}
              />
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
            trailing
          >
            {({ labelId, describedBy }) => (
              /* Two lengths: the kit's segmented control, which is a radio
                 group underneath (arrow keys move and choose). */
              <div aria-describedby={describedBy}>
                <SegmentedControl
                  size="sm"
                  aria-labelledby={labelId}
                  value={String(form.pinLength)}
                  onChange={(v) => set({ pinLength: Number(v) })}
                  options={PIN_LENGTHS.map((n) => ({ value: String(n), label: t("signIn.digits", { count: n }) }))}
                />
              </div>
            )}
          </SettingRow>
          <SettingRow label={t("signIn.pinAttempts")} description={t("signIn.pinAttemptsDesc")}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                value={String(form.pinAttempts)}
                onChange={(v) => set({ pinAttempts: Number(v) })}
                aria-describedby={describedBy}
                options={PIN_ATTEMPTS.map((n) => ({ value: String(n), label: t("signIn.tries", { count: n }) }))}
              />
            )}
          </SettingRow>
          <SettingRow label={t("signIn.deviceBound")} description={t("signIn.deviceBoundDesc")} labelFor={false} trailing>
            {({ labelId, describedBy }) => (
              <Switch
                checked={form.deviceBound}
                onChange={(deviceBound) => set({ deviceBound })}
                labelledBy={labelId}
                describedBy={describedBy}
              />
            )}
          </SettingRow>
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}

"use client";

import { CalendarClock, Coins, Gift, Sparkles, Tag } from "lucide-react";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Notice, PageShell, Skeleton, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getLoyaltyProgram, loyaltyTotals, updateLoyaltyProgram, type LoyaltyProgram } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch, controlCls } from "../_components/SettingsKit";

/**
 * The points programme, on the same anatomy as every other settings page: what
 * each setting is on the left, its field on the right, one save bar that exists
 * only while something has changed. It was a card of stacked fields and a
 * permanent Save button, with the sentence that says what the numbers mean in a
 * box with an orange bar down its side.
 */
export default function LoyaltySettingsPage() {
  const t = useTranslations("loyalty");
  const nf = useFormatter();
  const programQ = useApiQuery(() => getLoyaltyProgram(), []);
  const totalsQ = useApiQuery(() => loyaltyTotals(), []);

  if (programQ.loading || !programQ.data) {
    return (
      <PageShell title={t("settingsTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell title={t("settingsTitle")} description={t("settingsDescription")}>
      <div className="flex flex-col gap-section pb-hero">
        {/* Remount on save so the form reflects what was actually stored. The
            totals are passed in as children so the save bar stays the LAST
            thing in the column: a bar that appears between two cards would push
            the second one down every time something was typed. */}
        <ProgramForm
          key={JSON.stringify(programQ.data)}
          program={programQ.data}
          onSaved={() => {
            programQ.reload();
            totalsQ.reload();
          }}
        >
          <SettingsSection title={t("totalsTitle")}>
            <div className="px-card pb-card">
              {totalsQ.loading || !totalsQ.data ? (
                <Skeleton h={64} />
              ) : (
                <div className="grid grid-cols-2 gap-tight sm:grid-cols-4">
                  <Stat label={t("totalMembers")} value={nf.number(totalsQ.data.members)} />
                  <Stat label={t("totalEarned")} value={nf.number(totalsQ.data.earned)} />
                  <Stat label={t("totalSpent")} value={nf.number(totalsQ.data.spent)} />
                  <Stat
                    label={t("totalOutstanding")}
                    value={nf.number(totalsQ.data.outstanding)}
                    // Outstanding points are money the operator already owes.
                    note={t("outstandingWorth", {
                      value: formatMoney(totalsQ.data.outstanding * programQ.data.pointValue),
                    })}
                  />
                </div>
              )}
            </div>
          </SettingsSection>
        </ProgramForm>
      </div>
    </PageShell>
  );
}

/** A figure and what it counts. The tile is a quiet fill: a stroke around four numbers is noise. */
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-control bg-muted-wash p-comfortable">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="type-figure mt-inline text-2xl font-semibold text-fg">{value}</p>
      {note && <p className="mt-inline text-xs text-muted">{note}</p>}
    </div>
  );
}

function ProgramForm({
  program,
  onSaved,
  children,
}: {
  program: LoyaltyProgram;
  onSaved: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("loyalty");
  const nf = useFormatter();
  const toast = useToast();
  const [draft, setDraft] = useState<LoyaltyProgram>(program);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(program);

  const set = <K extends keyof LoyaltyProgram>(key: K, value: LoyaltyProgram[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setSaving(true);
    const res = await updateLoyaltyProgram(draft);
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fieldErrors ?? {});
      toast.error(res.error.message);
      return;
    }
    setErrors({});
    toast.success(t("saved"));
    onSaved();
  };

  // The whole programme in one sentence, in the numbers the operator typed.
  const exampleSpend = 100000; // ৳1,000
  const examplePoints = Math.floor((exampleSpend / 100) * draft.pointsPerUnit);
  const exampleWorth = examplePoints * draft.pointValue;

  const off = !draft.enabled;
  const numberField = "disabled:text-muted";

  return (
    <>
      <SettingsSection title={t("programTitle")}>
        <SettingRow icon={Sparkles} label={t("fieldEnabled")} description={t("enabledHelp")} labelFor={false} trailing>
          {({ labelId, describedBy }) => (
            <Switch checked={draft.enabled} onChange={(on) => set("enabled", on)} labelledBy={labelId} describedBy={describedBy} />
          )}
        </SettingRow>
        <SettingRow icon={Coins} label={t("fieldPointsPerUnit")} description={t("pointsPerUnitHelp")} error={errors.pointsPerUnit}>
          {({ id, describedBy }) => (
            <input
              id={id}
              type="number"
              inputMode="decimal"
              value={String(draft.pointsPerUnit)}
              onChange={(e) => set("pointsPerUnit", Math.max(0, Number(e.target.value || 0)))}
              disabled={off}
              aria-invalid={!!errors.pointsPerUnit || undefined}
              aria-describedby={describedBy}
              className={`${controlCls(!!errors.pointsPerUnit)} ${numberField}`}
            />
          )}
        </SettingRow>
        <SettingRow icon={Tag} label={t("fieldPointValue")} description={t("pointValueHelp")} error={errors.pointValue}>
          {({ id, describedBy }) => (
            <input
              id={id}
              type="number"
              inputMode="decimal"
              value={String(draft.pointValue / 100)}
              onChange={(e) => set("pointValue", Math.round(Number(e.target.value || 0) * 100))}
              disabled={off}
              aria-invalid={!!errors.pointValue || undefined}
              aria-describedby={describedBy}
              className={`${controlCls(!!errors.pointValue)} ${numberField}`}
            />
          )}
        </SettingRow>
        <SettingRow icon={Gift} label={t("fieldMinRedeem")} description={t("minRedeemHelp")} error={errors.minRedeemPoints}>
          {({ id, describedBy }) => (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              value={String(draft.minRedeemPoints)}
              onChange={(e) => set("minRedeemPoints", Math.max(0, Number(e.target.value || 0)))}
              disabled={off}
              aria-invalid={!!errors.minRedeemPoints || undefined}
              aria-describedby={describedBy}
              className={`${controlCls(!!errors.minRedeemPoints)} ${numberField}`}
            />
          )}
        </SettingRow>
        <SettingRow icon={CalendarClock} label={t("fieldExpiryMonths")} description={t("expiryMonthsHelp")} error={errors.expiryMonths}>
          {({ id, describedBy }) => (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              value={draft.expiryMonths == null ? "" : String(draft.expiryMonths)}
              onChange={(e) => set("expiryMonths", e.target.value === "" ? null : Number(e.target.value))}
              disabled={off}
              aria-invalid={!!errors.expiryMonths || undefined}
              aria-describedby={describedBy}
              className={`${controlCls(!!errors.expiryMonths)} ${numberField}`}
            />
          )}
        </SettingRow>

        {/* What the numbers add up to, in words: a quiet panel, not a callout
            with a bar down its side. */}
        <div className="px-card pb-card pt-tight">
          <Notice tone="neutral" icon={null} title={t("previewLabel")}>
            <p className="text-sm">
              {draft.enabled
                ? t("previewLine", {
                    spend: formatMoney(exampleSpend),
                    points: nf.number(examplePoints),
                    worth: formatMoney(exampleWorth),
                  })
                : t("previewOff")}
            </p>
            {draft.enabled && (
              <p className="mt-inline text-sm text-muted">
                {draft.expiryMonths == null ? t("previewNoExpiry") : t("previewExpiry", { months: draft.expiryMonths })}
              </p>
            )}
          </Notice>
        </div>
      </SettingsSection>

      {children}

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(program)} />
    </>
  );
}

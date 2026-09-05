"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getLoyaltyProgram, loyaltyTotals, updateLoyaltyProgram, type LoyaltyProgram } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default function LoyaltySettingsPage() {
  const t = useTranslations("loyalty");
  const programQ = useApiQuery(() => getLoyaltyProgram(), []);
  const totalsQ = useApiQuery(() => loyaltyTotals(), []);

  if (programQ.loading || !programQ.data) {
    return (
      <PageShell title={t("settingsTitle")}>
        <div className="h-64 animate-pulse rounded-md bg-line" />
      </PageShell>
    );
  }

  return (
    <PageShell title={t("settingsTitle")} description={t("settingsDescription")}>
      <div className="flex max-w-3xl flex-col gap-section">
        {/* Remount on save so the form reflects what was actually stored. */}
        <ProgramForm
          key={JSON.stringify(programQ.data)}
          program={programQ.data}
          onSaved={() => {
            programQ.reload();
            totalsQ.reload();
          }}
        />

        <div className="card-surface p-section">
          <p className="type-label mb-comfortable text-[12px] text-muted">{t("totalsTitle")}</p>
          {totalsQ.loading || !totalsQ.data ? (
            <div className="h-16 animate-pulse rounded-sm bg-subtle" />
          ) : (
            <div className="grid grid-cols-2 gap-tight sm:grid-cols-4">
              <Stat label={t("totalMembers")} value={String(totalsQ.data.members)} />
              <Stat label={t("totalEarned")} value={totalsQ.data.earned.toLocaleString()} />
              <Stat label={t("totalSpent")} value={totalsQ.data.spent.toLocaleString()} />
              <Stat
                label={t("totalOutstanding")}
                value={totalsQ.data.outstanding.toLocaleString()}
                // Outstanding points are money the operator already owes.
                note={t("outstandingWorth", {
                  value: formatMoney(totalsQ.data.outstanding * programQ.data.pointValue),
                })}
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-sm border border-line p-comfortable">
      <p className="type-label text-[12px] text-muted">{label}</p>
      <p className="mt-inline font-mono text-lg tabular-nums">{value}</p>
      {note && <p className="mt-inline text-[12px] text-muted">{note}</p>}
    </div>
  );
}

function ProgramForm({
  program,
  onSaved,
}: {
  program: LoyaltyProgram;
  onSaved: () => void;
}) {
  const t = useTranslations("loyalty");
  const toast = useToast();
  const [draft, setDraft] = useState<LoyaltyProgram>(program);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="card-surface flex flex-col gap-section p-section">
      <FormField
        label={t("fieldEnabled")}
        variant="toggle"
        checked={draft.enabled}
        onChange={(e) => set("enabled", (e.target as HTMLInputElement).checked)}
        help={t("enabledHelp")}
      />

      <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
        <FormField
          label={t("fieldPointsPerUnit")}
          variant="number"
          value={String(draft.pointsPerUnit)}
          onChange={(e) => set("pointsPerUnit", Math.max(0, Number(e.target.value || 0)))}
          disabled={!draft.enabled}
          error={errors.pointsPerUnit}
          help={t("pointsPerUnitHelp")}
        />
        <FormField
          label={t("fieldPointValue")}
          variant="number"
          value={String(draft.pointValue / 100)}
          onChange={(e) => set("pointValue", Math.round(Number(e.target.value || 0) * 100))}
          disabled={!draft.enabled}
          error={errors.pointValue}
          help={t("pointValueHelp")}
        />
        <FormField
          label={t("fieldMinRedeem")}
          variant="number"
          value={String(draft.minRedeemPoints)}
          onChange={(e) => set("minRedeemPoints", Math.max(0, Number(e.target.value || 0)))}
          disabled={!draft.enabled}
          error={errors.minRedeemPoints}
          help={t("minRedeemHelp")}
        />
        <FormField
          label={t("fieldExpiryMonths")}
          variant="number"
          value={draft.expiryMonths == null ? "" : String(draft.expiryMonths)}
          onChange={(e) =>
            set("expiryMonths", e.target.value === "" ? null : Number(e.target.value))
          }
          disabled={!draft.enabled}
          error={errors.expiryMonths}
          help={t("expiryMonthsHelp")}
        />
      </div>

      <div className="rounded-sm border-l-2 border-ember bg-ember/5 p-comfortable">
        <p className="type-label text-[12px] text-muted">{t("previewLabel")}</p>
        <p className="mt-inline text-[13px]">
          {draft.enabled
            ? t("previewLine", {
                spend: formatMoney(exampleSpend),
                points: examplePoints,
                worth: formatMoney(exampleWorth),
              })
            : t("previewOff")}
        </p>
        {draft.enabled && (
          <p className="mt-inline text-[13px] text-muted">
            {draft.expiryMonths == null
              ? t("previewNoExpiry")
              : t("previewExpiry", { months: draft.expiryMonths })}
          </p>
        )}
      </div>

      <div>
        <Button onClick={save} loading={saving}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

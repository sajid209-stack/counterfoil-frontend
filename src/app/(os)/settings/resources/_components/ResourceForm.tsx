"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, useToast } from "@/components/ui";
import {
  createResourceRecord,
  updateResource,
  type Location,
  type Resource,
  type ResourceInput,
} from "@/lib/api";

const NOUNS = ["Field", "Court", "Lane", "Room", "Table", "Studio", "Bay"];
const plural = (n: string) => (n.endsWith("s") ? n : `${n}s`);

interface FormState {
  name: string;
  nounSingular: string;
  locationId: string;
  outOfService: boolean;
  outOfServiceReason: string;
  active: boolean;
  rateKind: "none" | "premium" | "replace";
  rateAmount: string; // major units
}

const fromResource = (r: Resource): FormState => ({
  name: r.name,
  nounSingular: r.nounSingular,
  locationId: r.locationId ?? "",
  outOfService: r.outOfService,
  outOfServiceReason: r.outOfServiceReason ?? "",
  active: r.status !== "inactive",
  rateKind: r.rateOverride?.kind ?? "none",
  rateAmount: r.rateOverride ? String(r.rateOverride.amount / 100) : "",
});

export function ResourceForm({
  mode,
  resource,
  locations,
  defaultNoun = "Field",
}: {
  mode: "create" | "edit";
  resource?: Resource;
  locations: Location[];
  defaultNoun?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("settings");
  const initial = useMemo<FormState>(
    () =>
      resource
        ? fromResource(resource)
        : { name: "", nounSingular: defaultNoun, locationId: locations[0]?.id ?? "", outOfService: false, outOfServiceReason: "", active: true, rateKind: "none" as const, rateAmount: "" },
    [resource, locations, defaultNoun],
  );
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    const input: ResourceInput = {
      name: state.name,
      nounSingular: state.nounSingular,
      nounPlural: plural(state.nounSingular),
      locationId: state.locationId || null,
      outOfService: state.outOfService,
      outOfServiceReason: state.outOfService ? state.outOfServiceReason || null : null,
      rateOverride:
        state.rateKind !== "none" && parseFloat(state.rateAmount) > 0
          ? { kind: state.rateKind, amount: Math.round(parseFloat(state.rateAmount) * 100) }
          : null,
      status: state.active ? "active" : "inactive",
    };
    const res = mode === "create" ? await createResourceRecord(input) : await updateResource(resource!.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success(mode === "create" ? t("resources.added", { noun: input.nounSingular }) : t("common.changesSaved"));
      if (mode === "create") router.push(`/settings/resources/${res.data.id}`);
      else setState(fromResource(res.data));
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-section pb-hero">
      <div className="rounded-md border border-line bg-card p-major">
        <h2 className="type-h2 mb-section text-base">{t("common.details")}</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <FormField label={t("common.name")} required placeholder={t("resources.namePlaceholder")} value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
          <FormField
            label={t("resources.whatIsIt")}
            variant="select"
            value={state.nounSingular}
            onChange={(e) => set("nounSingular", e.target.value)}
            options={NOUNS.map((n) => ({ value: n, label: t(`resources.noun${n}` as never) }))}
            help={t("resources.whatIsItHelp")}
          />
          <FormField label={t("common.location")} variant="select" value={state.locationId} onChange={(e) => set("locationId", e.target.value)} options={[{ value: "", label: t("resources.noLocation") }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
          <FormField label={t("common.active")} variant="toggle" checked={state.active} onChange={(e) => set("active", (e.target as HTMLInputElement).checked)} />
        </div>
      </div>

      <div className="rounded-md border border-line bg-card p-major">
        <h2 className="type-h2 mb-section text-base">{t("resources.rate")}</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <FormField
            label={t("resources.priceAdjustment")}
            variant="select"
            value={state.rateKind}
            onChange={(e) => set("rateKind", e.target.value as FormState["rateKind"])}
            options={[
              { value: "none", label: t("resources.rateNone") },
              { value: "premium", label: t("resources.ratePremium") },
              { value: "replace", label: t("resources.rateReplace") },
            ]}
            help={t("resources.rateHelp")}
          />
          {state.rateKind !== "none" && (
            <FormField label={state.rateKind === "premium" ? t("resources.extraPerBooking") : t("resources.ratePerHour")} variant="number" value={state.rateAmount} onChange={(e) => set("rateAmount", e.target.value)} />
          )}
        </div>
      </div>

      <div className="rounded-md border border-line bg-card p-major">
        <h2 className="type-h2 mb-section text-base">{t("resources.outOfServiceSection")}</h2>
        <FormField
          label={t("resources.takeOutOfService", { noun: state.nounSingular.toLowerCase() })}
          variant="toggle"
          checked={state.outOfService}
          onChange={(e) => set("outOfService", (e.target as HTMLInputElement).checked)}
          help={t("resources.takeOutHelp")}
        />
        {state.outOfService && (
          <FormField label={t("resources.reason")} placeholder={t("resources.reasonPlaceholder")} value={state.outOfServiceReason} onChange={(e) => set("outOfServiceReason", e.target.value)} className="mt-section max-w-sm" />
        )}
      </div>

      <div className="sticky bottom-0 max-md:bottom-[calc(56px+env(safe-area-inset-bottom))] flex items-center justify-end gap-tight border-t border-line bg-surface py-section">
        <Button variant="secondary" onClick={() => router.push("/settings/resources")} disabled={saving}>{t("common.cancel")}</Button>
        <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>{mode === "create" ? t("resources.add") : t("common.saveChanges")}</Button>
      </div>
    </div>
  );
}

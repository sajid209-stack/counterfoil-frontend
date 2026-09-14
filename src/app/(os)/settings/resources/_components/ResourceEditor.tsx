"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createResourceRecord, ownerBusyDetailed, updateResource, type Location, type Resource } from "@/lib/api";
import { DEMO_TODAY, toTime } from "@/lib/schedule";
import { CreateBar, SaveBar, SettingRow, SettingsSection, SuffixInput, Switch, controlCls } from "../../_components/SettingsKit";

const NOUNS = ["Field", "Court", "Lane", "Room", "Table", "Studio", "Bay"];
const plural = (n: string) => (n.endsWith("s") ? n : `${n}s`);
const AMOUNT = /^\d{1,7}(\.\d{1,2})?$/;

type RateKind = "none" | "premium" | "replace";

interface Draft {
  name: string;
  noun: string;
  locationId: string;
  rateKind: RateKind;
  rateAmount: string;
  outOfService: boolean;
  reason: string;
}

const fromResource = (r: Resource): Draft => ({
  name: r.name,
  noun: r.nounSingular,
  locationId: r.locationId ?? "",
  rateKind: r.rateOverride?.kind ?? "none",
  rateAmount: r.rateOverride ? String(r.rateOverride.amount / 100) : "",
  outOfService: r.outOfService,
  reason: r.outOfServiceReason ?? "",
});

/**
 * A court, a lane, a field — something bookings take up.
 *
 * "Active" and "Out of service" were two switches on the same card and it was
 * never said how they differed. They are different things: out of service is
 * temporary and has a reason the till shows staff ("resurfacing"), retiring is
 * for something that is gone. Out of service is part of the draft with its
 * reason beside it; retiring is its own confirmed action. The price choice says
 * what each option does to what a customer pays, and "Today" answers the
 * question asked before taking anything out of service — what is booked on it.
 */
export function ResourceEditor({
  mode,
  resource,
  locations,
  defaultNoun = "Field",
  onSaved,
}: {
  mode: "create" | "edit";
  resource?: Resource;
  locations: Location[];
  defaultNoun?: string;
  onSaved?: (r: Resource) => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const radioName = useId();

  const initial = useMemo<Draft>(() => {
    if (resource) return fromResource(resource);
    const open = locations.filter((l) => l.status === "active");
    return {
      name: "",
      noun: defaultNoun,
      locationId: open.length === 1 ? open[0].id : "",
      rateKind: "none",
      rateAmount: "",
      outOfService: false,
      reason: "",
    };
  }, [resource, locations, defaultNoun]);

  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [busy, setBusy] = useState(false);
  const saved = base ?? initial;
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });

  const judge = mode === "edit" || !!draft;
  const nameErr = judge && !form.name.trim() ? t("resources.nameRequired") : undefined;
  const amountBad = form.rateKind !== "none" && (!AMOUNT.test(form.rateAmount) || Number(form.rateAmount) <= 0);
  const amountErr = judge && amountBad ? t("resources.amountRequired") : undefined;
  const invalid = !form.name.trim() || amountBad;
  const nouns = NOUNS.includes(form.noun) ? NOUNS : [form.noun, ...NOUNS];
  const nounLabel = (n: string) => (NOUNS.includes(n) ? t(`resources.noun${n}`) : n);

  const submit = async () => {
    setSaving(true);
    const input = {
      name: form.name.trim(),
      nounSingular: form.noun,
      nounPlural: plural(form.noun),
      locationId: form.locationId || null,
      outOfService: form.outOfService,
      outOfServiceReason: form.outOfService ? form.reason.trim() || null : null,
      rateOverride:
        form.rateKind === "none" ? null : { kind: form.rateKind, amount: Math.round(Number(form.rateAmount) * 100) },
      status: resource?.status ?? ("active" as const),
    };
    const res = mode === "create" ? await createResourceRecord(input) : await updateResource(resource!.id, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "create") {
      toast.success(t("resources.added", { noun: input.nounSingular }));
      router.push(`/settings/resources/${res.data.id}`);
      return;
    }
    setBase(fromResource(res.data));
    setDraft(null);
    onSaved?.(res.data);
    toast.success(t("common.changesSaved"));
  };

  const setStatus = async (status: "active" | "inactive") => {
    if (!resource) return;
    setBusy(true);
    const res = await updateResource(resource.id, { status });
    setBusy(false);
    setConfirmRetire(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    onSaved?.(res.data);
    toast.success(status === "inactive" ? t("resources.retired", { name: resource.name }) : t("resources.restored", { name: resource.name }));
  };

  const today = resource ? ownerBusyDetailed(resource.id, DEMO_TODAY) : [];
  const RATES: RateKind[] = ["none", "premium", "replace"];
  const rateTitle: Record<RateKind, string> = {
    none: t("resources.rateNone"),
    premium: t("resources.ratePremium"),
    replace: t("resources.rateReplace"),
  };
  const rateDesc: Record<RateKind, string> = {
    none: t("resources.rateNoneDesc"),
    premium: t("resources.ratePremiumDesc"),
    replace: t("resources.rateReplaceDesc"),
  };

  return (
    <div className="flex max-w-3xl flex-col gap-section pb-hero">
      <SettingsSection title={t("resources.detailsTitle")} description={t("resources.detailsDesc")}>
        <SettingRow label={t("common.name")} error={nameErr}>
          {({ id, describedBy }) => (
            <input
              id={id}
              value={form.name}
              placeholder={t("resources.namePlaceholder")}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
              aria-invalid={!!nameErr || undefined}
              aria-describedby={describedBy}
              className={controlCls(!!nameErr)}
            />
          )}
        </SettingRow>
        <SettingRow label={t("resources.whatIsIt")} description={t("resources.kindDesc")}>
          {({ id, describedBy }) => (
            <select
              id={id}
              value={form.noun}
              onChange={(e) => set({ noun: e.target.value })}
              aria-describedby={describedBy}
              className={cn(controlCls(), "pr-section")}
            >
              {nouns.map((n) => (
                <option key={n} value={n}>
                  {nounLabel(n)}
                </option>
              ))}
            </select>
          )}
        </SettingRow>
        <SettingRow label={t("common.location")} description={t("resources.locationDesc")}>
          {({ id, describedBy }) => (
            <select
              id={id}
              value={form.locationId}
              onChange={(e) => set({ locationId: e.target.value })}
              aria-describedby={describedBy}
              className={cn(controlCls(), "pr-section")}
            >
              <option value="">{t("resources.noLocation")}</option>
              {locations
                .filter((l) => l.status !== "archived")
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          )}
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("resources.priceTitle")} description={t("resources.priceDesc")}>
        <div role="radiogroup" aria-label={t("resources.priceTitle")} className="flex flex-col gap-tight px-major py-section">
          {RATES.map((k) => {
            const checked = form.rateKind === k;
            return (
              <label
                key={k}
                className={cn(
                  "flex cursor-pointer items-start gap-comfortable rounded-md border px-section py-comfortable transition-colors duration-quick",
                  checked ? "border-ember-solid bg-ember/5" : "border-line hover:bg-subtle/60",
                )}
              >
                <input
                  type="radio"
                  name={radioName}
                  value={k}
                  checked={checked}
                  onChange={() => set({ rateKind: k })}
                  className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{rateTitle[k]}</span>
                  <span className="mt-inline block text-[13px] leading-relaxed text-muted">{rateDesc[k]}</span>
                </span>
              </label>
            );
          })}
        </div>
        {form.rateKind !== "none" && (
          <SettingRow
            label={form.rateKind === "premium" ? t("resources.extraPerBooking") : t("resources.ratePerHour")}
            error={amountErr}
          >
            {({ id, describedBy }) => (
              <SuffixInput
                id={id}
                value={form.rateAmount}
                onChange={(v) => set({ rateAmount: v })}
                suffix="৳"
                invalid={!!amountErr}
                describedBy={describedBy}
              />
            )}
          </SettingRow>
        )}
      </SettingsSection>

      <SettingsSection title={t("resources.availabilityTitle")} description={t("resources.availabilityDesc")}>
        <SettingRow label={t("resources.outLabel")} description={t("resources.outDesc")} labelFor={false}>
          {({ labelId, describedBy }) => (
            <div className="flex sm:justify-end">
              <Switch checked={form.outOfService} onChange={(on) => set({ outOfService: on })} labelledBy={labelId} describedBy={describedBy} />
            </div>
          )}
        </SettingRow>
        {form.outOfService && (
          <SettingRow label={t("resources.reason")} description={t("resources.reasonDesc")}>
            {({ id, describedBy }) => (
              <input
                id={id}
                value={form.reason}
                placeholder={t("resources.reasonPlaceholder")}
                onChange={(e) => set({ reason: e.target.value })}
                aria-describedby={describedBy}
                className={controlCls()}
              />
            )}
          </SettingRow>
        )}
      </SettingsSection>

      {mode === "edit" && (
        <SettingsSection title={t("resources.todayTitle")} description={t("resources.todayDesc")}>
          {today.length === 0 ? (
            <p className="px-major py-section text-sm text-muted">{t("resources.todayNone")}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {today.map((s) => (
                <li key={`${s.start}-${s.end}`} className="flex flex-wrap items-baseline gap-x-section gap-y-inline px-major py-comfortable">
                  <span className="w-28 shrink-0 text-sm font-medium tabular-nums text-fg">
                    {toTime(s.start)}–{toTime(s.end)}
                  </span>
                  <span className="min-w-0 text-sm text-muted">{s.label}</span>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      )}

      {mode === "edit" && resource && (
        <SettingsSection title={t("resources.statusTitle")} description={t("resources.statusDesc")}>
          <SettingRow
            label={t("resources.usingLabel")}
            description={resource.status === "inactive" ? t("resources.usingOff") : t("resources.usingOn")}
            labelFor={false}
          >
            {() => (
              <div className="flex sm:justify-end">
                {resource.status === "inactive" ? (
                  <Button onClick={() => setStatus("active")} loading={busy}>
                    {t("resources.restore")}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmRetire(true)}>
                    {t("resources.retire")}
                  </Button>
                )}
              </div>
            )}
          </SettingRow>
        </SettingsSection>
      )}

      {mode === "create" ? (
        <CreateBar
          dirty={!!draft}
          invalid={invalid}
          saving={saving}
          note={t("resources.createNote")}
          invalidNote={t("resources.createInvalid")}
          submitLabel={t("resources.add")}
          onSubmit={submit}
          onCancel={() => router.push("/settings/resources")}
        />
      ) : (
        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={() => setDraft(null)} />
      )}

      {resource && (
        <ConfirmDialog
          open={confirmRetire}
          onClose={() => setConfirmRetire(false)}
          onConfirm={() => setStatus("inactive")}
          title={t("resources.retireTitle", { name: resource.name })}
          message={t("resources.retireBody")}
          confirmLabel={t("resources.retire")}
          loading={busy}
        />
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createCounter,
  updateCounter,
  type Category,
  type Counter,
  type Device,
  type Location,
  type PaymentMethod,
  type Product,
} from "@/lib/api";
import { CreateBar, SaveBar, SettingRow, SettingsSection, Switch, controlCls } from "../../_components/SettingsKit";
import { METHODS, METHOD_KEY, NEEDS_ACCOUNT } from "../_lib/methods";

interface Draft {
  name: string;
  locationId: string;
  methods: PaymentMethod[];
  allowAll: boolean;
  productIds: string[];
}

const orderedMethods = (ms: PaymentMethod[]) => METHODS.filter((m) => ms.includes(m));

const fromCounter = (c: Counter): Draft => ({
  name: c.name,
  locationId: c.locationId,
  methods: orderedMethods(c.allowedPaymentMethods),
  allowAll: c.allowedProductIds === "all",
  productIds: c.allowedProductIds === "all" ? [] : [...c.allowedProductIds].sort(),
});

const chip =
  "inline-flex min-h-11 items-center rounded-full border border-line px-comfortable text-[13px] text-fg transition-colors duration-quick hover:bg-subtle/60 md:min-h-9";
const quiet =
  "inline-flex min-h-11 items-center rounded-sm px-tight text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9";

/**
 * A counter: where it is, how customers can pay at it, what it sells.
 *
 * The payment methods were six unexplained checkboxes, and nothing said that
 * ticking bKash did nothing at all while no payment account was live — the
 * till would quietly offer cash only. Each method now says what it is, and the
 * page says plainly when the ones that need a provider cannot work yet.
 *
 * "Allowed bookings" was a toggle over an alphabetical wall of every product.
 * The bookings are grouped under the categories the till already shows as
 * chips, with a whole group selectable at once.
 */
export function CounterEditor({
  mode,
  counter,
  locations,
  products,
  categories,
  devices = [],
  liveAccount,
  onSaved,
}: {
  mode: "create" | "edit";
  counter?: Counter;
  locations: Location[];
  products: Product[];
  categories: Category[];
  devices?: Device[];
  /** Whether any payment account can take charges right now. */
  liveAccount: boolean;
  onSaved?: (c: Counter) => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const places = locations.filter((l) => l.status !== "archived");

  const initial = useMemo<Draft>(() => {
    if (counter) return fromCounter(counter);
    const open = locations.filter((l) => l.status === "active");
    return { name: "", locationId: open[0]?.id ?? locations[0]?.id ?? "", methods: ["cash"], allowAll: true, productIds: [] };
  }, [counter, locations]);

  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const saved = base ?? initial;
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });

  const judge = mode === "edit" || !!draft;
  const nameErr = judge && !form.name.trim() ? t("counters.nameRequired") : undefined;
  const methodsErr = judge && form.methods.length === 0 ? t("counters.methodsRequired") : undefined;
  const productsErr = judge && !form.allowAll && form.productIds.length === 0 ? t("counters.productsRequired") : undefined;
  const invalid = !form.name.trim() || !form.locationId || form.methods.length === 0 || (!form.allowAll && form.productIds.length === 0);
  const unbacked = !liveAccount && form.methods.some((m) => NEEDS_ACCOUNT.has(m));

  const sellable = products.filter((p) => p.status !== "archived");
  const known = new Set(categories.map((c) => c.id));
  const groups = [
    ...[...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ key: c.id, name: c.name, items: sellable.filter((p) => p.categoryId === c.id) })),
    { key: "none", name: t("counters.uncategorised"), items: sellable.filter((p) => !p.categoryId || !known.has(p.categoryId)) },
  ].filter((g) => g.items.length > 0);

  const toggleMethod = (m: PaymentMethod, on: boolean) =>
    set({ methods: orderedMethods(on ? [...form.methods, m] : form.methods.filter((x) => x !== m)) });
  const setProducts = (ids: string[]) => set({ productIds: Array.from(new Set(ids)).sort() });

  const submit = async () => {
    setSaving(true);
    const input = {
      name: form.name.trim(),
      locationId: form.locationId,
      allowedProductIds: form.allowAll ? ("all" as const) : form.productIds,
      allowedPaymentMethods: form.methods,
      status: counter?.status ?? ("active" as const),
    };
    const res = mode === "create" ? await createCounter(input) : await updateCounter(counter!.id, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "create") {
      toast.success(t("counters.created"));
      router.push(`/settings/counters/${res.data.id}`);
      return;
    }
    setBase(fromCounter(res.data));
    setDraft(null);
    onSaved?.(res.data);
    toast.success(t("common.changesSaved"));
  };

  const setStatus = async (status: "active" | "inactive") => {
    if (!counter) return;
    setBusy(true);
    const res = await updateCounter(counter.id, { status });
    setBusy(false);
    setConfirmStop(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    onSaved?.(res.data);
    toast.success(status === "inactive" ? t("counters.stopped", { name: counter.name }) : t("counters.started", { name: counter.name }));
  };

  return (
    <div className="flex max-w-3xl flex-col gap-section pb-hero">
      <SettingsSection title={t("counters.detailsTitle")} description={t("counters.detailsDesc")}>
        <SettingRow label={t("common.name")} error={nameErr}>
          {({ id, describedBy }) => (
            <input
              id={id}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="off"
              aria-invalid={!!nameErr || undefined}
              aria-describedby={describedBy}
              className={controlCls(!!nameErr)}
            />
          )}
        </SettingRow>
        <SettingRow label={t("common.location")} description={t("counters.locationDesc")}>
          {({ id, describedBy }) => (
            <select
              id={id}
              value={form.locationId}
              onChange={(e) => set({ locationId: e.target.value })}
              aria-describedby={describedBy}
              className={cn(controlCls(), "pr-section")}
            >
              {places.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.status === "inactive" ? `${l.name} · ${t("common.inactive")}` : l.name}
                </option>
              ))}
            </select>
          )}
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("counters.paymentsTitle")} description={t("counters.paymentsDesc")}>
        <ul className="divide-y divide-hairline">
          {METHODS.map((m) => (
            <li key={m} className="px-major py-tight">
              <label className="flex min-h-12 cursor-pointer items-center gap-comfortable">
                <input
                  type="checkbox"
                  checked={form.methods.includes(m)}
                  onChange={(e) => toggleMethod(m, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-ember"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{t(`counters.method${METHOD_KEY[m]}`)}</span>
                  <span className="block text-[13px] text-muted">{t(`counters.methodDesc.${m}`)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {methodsErr && <p className="px-major py-tight text-[12px] text-danger">{methodsErr}</p>}
        {unbacked && (
          <div className="flex flex-col gap-tight bg-warning-wash px-major py-tight sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-tight text-[13px] text-fg">
              <CircleAlert size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-warning" />
              {t("counters.needsAccount")}
            </p>
            <Link href="/settings/payments" className={cn(chip, "shrink-0 self-start sm:self-auto")}>
              {t("counters.connectAccount")}
            </Link>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title={t("counters.sellsTitle")} description={t("counters.sellsDesc")}>
        <SettingRow label={t("counters.sellAll")} description={t("counters.sellAllDesc")} labelFor={false}>
          {({ labelId, describedBy }) => (
            <div className="flex sm:justify-end">
              <Switch checked={form.allowAll} onChange={(on) => set({ allowAll: on })} labelledBy={labelId} describedBy={describedBy} />
            </div>
          )}
        </SettingRow>
        {!form.allowAll && (
          <div className="px-major py-section">
            <p className="text-[13px] text-muted" aria-live="polite">
              {t("counters.pickedCount", { picked: form.productIds.length, total: sellable.length })}
            </p>
            {productsErr && <p className="mt-inline text-[12px] text-danger">{productsErr}</p>}
            <div className="mt-section flex flex-col gap-section">
              {groups.map((g) => {
                const ids = g.items.map((p) => p.id);
                const all = ids.every((id) => form.productIds.includes(id));
                const headingId = `counter-group-${g.key}`;
                return (
                  <div key={g.key} role="group" aria-labelledby={headingId}>
                    <div className="flex items-center justify-between gap-tight">
                      <p id={headingId} className="text-[13px] font-medium text-fg">
                        {g.name}
                      </p>
                      <button
                        type="button"
                        className={quiet}
                        onClick={() => setProducts(all ? form.productIds.filter((id) => !ids.includes(id)) : [...form.productIds, ...ids])}
                      >
                        {all ? t("counters.clearAll") : t("counters.selectAll")}
                      </button>
                    </div>
                    <div className="mt-tight flex flex-wrap gap-tight">
                      {g.items.map((p) => {
                        const checked = form.productIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "inline-flex min-h-11 max-w-full cursor-pointer items-center gap-tight rounded-full border px-comfortable py-inline text-[13px] transition-colors duration-quick md:min-h-9",
                              checked ? "border-ember-solid bg-ember/5 text-fg" : "border-line text-muted hover:bg-subtle/60",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => setProducts(e.target.checked ? [...form.productIds, p.id] : form.productIds.filter((x) => x !== p.id))}
                              className="h-4 w-4 shrink-0 accent-ember"
                            />
                            <span className="min-w-0 break-words">{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SettingsSection>

      {mode === "edit" && (
        <SettingsSection title={t("counters.devicesTitle")} description={t("counters.devicesDesc")}>
          <SettingRow
            label={t("counters.pairedLabel")}
            description={devices.length === 0 ? t("counters.noDevice") : undefined}
            labelFor={false}
          >
            {() => (
              <ul className="flex flex-wrap gap-tight sm:justify-end">
                {devices.length > 0 ? (
                  devices.map((d) => (
                    <li key={d.id}>
                      <Link href={`/settings/devices/${d.id}`} className={chip}>
                        {d.name}
                      </Link>
                    </li>
                  ))
                ) : (
                  <li>
                    <Link href="/settings/devices/new" className={chip}>
                      {t("counters.registerDevice")}
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </SettingRow>
        </SettingsSection>
      )}

      {mode === "edit" && counter && (
        <SettingsSection title={t("counters.statusTitle")} description={t("counters.statusDesc")}>
          <SettingRow
            label={t("counters.sellingLabel")}
            description={counter.status === "inactive" ? t("counters.sellingOff") : t("counters.sellingOn")}
            labelFor={false}
          >
            {() => (
              <div className="flex sm:justify-end">
                {counter.status === "inactive" ? (
                  <Button onClick={() => setStatus("active")} loading={busy}>
                    {t("counters.start")}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmStop(true)}>
                    {t("counters.stop")}
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
          note={t("counters.createNote")}
          invalidNote={t("counters.createInvalid")}
          submitLabel={t("counters.createCounter")}
          onSubmit={submit}
          onCancel={() => router.push("/settings/counters")}
        />
      ) : (
        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={submit} onDiscard={() => setDraft(null)} />
      )}

      {counter && (
        <ConfirmDialog
          open={confirmStop}
          onClose={() => setConfirmStop(false)}
          onConfirm={() => setStatus("inactive")}
          title={t("counters.stopTitle", { name: counter.name })}
          message={t("counters.stopBody")}
          confirmLabel={t("counters.stop")}
          loading={busy}
        />
      )}
    </div>
  );
}

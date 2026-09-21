"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { Button, EmptyState, PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  getStorefrontFor,
  listLocations,
  listProducts,
  storefrontProducts,
  updateStorefront,
  type CategoryColor,
  type Product,
  type Storefront,
} from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch, controlCls } from "../../_components/SettingsKit";
import { CATEGORY_COLORS, COLOR_DOT } from "../../categories/_components/ColorPicker";

interface Draft {
  slug: string;
  headline: string;
  intro: string;
  contactPhone: string;
  contactEmail: string;
  accent: CategoryColor | null;
  featured: string[];
}

const fromRecord = (s: Storefront): Draft => ({
  slug: s.slug,
  headline: s.headline ?? "",
  intro: s.intro ?? "",
  contactPhone: s.contactPhone ?? "",
  contactEmail: s.contactEmail ?? "",
  accent: s.accent ?? null,
  featured: [...s.featured],
});

/**
 * One venue's page, edited.
 *
 * The one thing worth explaining is **what appears on it**. An empty list is
 * not empty: it means everything sold online at this venue, in the catalogue's
 * own order, which is what an operator who never opens this screen gets and is
 * almost always right. Choosing bookings here turns that into an explicit list
 * with an order — and the moment it is explicit, a booking added to the
 * catalogue later will NOT appear on the page until somebody says so. The
 * screen says that rather than leaving it to be discovered.
 */
export default function StorefrontEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const toast = useToast();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const [record, setRecord] = useState<Storefront | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getStorefrontFor(params.id).then((res) => {
      if (!alive) return;
      if (res.ok) setRecord(res.data);
      else setLoadFailed(true);
    });
    return () => { alive = false; };
  }, [params.id]);

  const location = (locationsQ.data?.data ?? []).find((l) => l.id === params.id);
  const products = useMemo(() => (productsQ.data?.data ?? []) as Product[], [productsQ.data]);
  /** Everything this venue COULD show, which is what the chooser offers. */
  const sellable = useMemo(
    () =>
      products.filter(
        (p) => p.status === "active" && p.channels.includes("online") && p.locationIds.includes(params.id),
      ),
    [products, params.id],
  );

  if (loadFailed || (!locationsQ.loading && !location)) {
    return (
      <PageShell title={t("storefront.title")}>
        <EmptyState
          title={t("storefront.notFoundTitle")}
          action={<Button onClick={() => router.push("/settings/storefront")}>{t("storefront.back")}</Button>}
        />
      </PageShell>
    );
  }
  if (!record || !location || productsQ.loading) {
    return (
      <PageShell title={t("storefront.title")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const saved = fromRecord(record);
  const form = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Draft>) => setDraft({ ...form, ...patch });
  const slugErr = !form.slug.trim()
    ? t("storefront.slugRequired")
    : !/^[a-z0-9][a-z0-9-]*$/.test(form.slug.trim())
      ? t("storefront.slugShape")
      : undefined;

  /** What the page will actually show, from the draft rather than the record,
   *  so the count under the chooser answers for what is on screen. */
  const showing = storefrontProducts({ ...record, featured: form.featured }, products);

  const toggle = (id: string) => {
    if (form.featured.length === 0) {
      // Going from "everything" to a list: start from what is on the page now,
      // minus the one being turned off — anything else would silently drop
      // every other booking at the same moment.
      set({ featured: sellable.filter((p) => p.id !== id).map((p) => p.id) });
      return;
    }
    set(
      form.featured.includes(id)
        ? { featured: form.featured.filter((x) => x !== id) }
        : { featured: [...form.featured, id] },
    );
  };

  const move = (id: string, dir: -1 | 1) => {
    const list = form.featured.length ? [...form.featured] : sellable.map((p) => p.id);
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ featured: list });
  };

  const save = async () => {
    setSaving(true);
    const res = await updateStorefront(record.id, {
      slug: form.slug.trim(),
      headline: form.headline.trim() || undefined,
      intro: form.intro.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      accent: form.accent,
      featured: form.featured,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.slug ?? res.error.message);
      return;
    }
    setRecord(res.data);
    setDraft(null);
    toast.success(t("common.changesSaved"));
  };

  const ordered = form.featured.length
    ? form.featured.map((id) => sellable.find((p) => p.id === id)).filter((p): p is Product => !!p)
    : sellable;
  const rest = sellable.filter((p) => !ordered.includes(p));

  return (
    <PageShell
      title={location.name}
      description={t("storefront.editorDescription")}
      actions={
        record.published ? (
          <Link href={`/s/${record.slug}`} target="_blank" rel="noreferrer">
            <Button variant="secondary" icon={<ExternalLink size={16} strokeWidth={1.5} />}>
              {t("storefront.viewPage")}
            </Button>
          </Link>
        ) : undefined
      }
    >
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("storefront.addressTitle")} description={t("storefront.addressDesc")}>
          <SettingRow label={t("storefront.slugLabel")} description={t("storefront.slugDesc")} error={slugErr}>
            {({ id, describedBy }) => (
              <div className="flex items-center gap-inline">
                <span className="shrink-0 font-mono text-[13px] text-muted">/s/</span>
                <input
                  id={id}
                  value={form.slug}
                  onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!slugErr || undefined}
                  aria-describedby={describedBy}
                  className={cn(controlCls(!!slugErr), "font-mono")}
                />
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("storefront.wordsTitle")} description={t("storefront.wordsDesc")}>
          <SettingRow label={t("storefront.headlineLabel")} description={t("storefront.headlineDesc")}>
            {({ id, describedBy }) => (
              <input
                id={id}
                value={form.headline}
                onChange={(e) => set({ headline: e.target.value })}
                placeholder={location.name}
                aria-describedby={describedBy}
                className={controlCls()}
              />
            )}
          </SettingRow>
          <SettingRow label={t("storefront.introLabel")} description={t("storefront.introDesc")} layout="stack">
            {({ id, describedBy }) => (
              <textarea
                id={id}
                rows={4}
                value={form.intro}
                onChange={(e) => set({ intro: e.target.value })}
                aria-describedby={describedBy}
                className={cn(controlCls(), "h-auto py-tight leading-relaxed")}
              />
            )}
          </SettingRow>
          <SettingRow label={t("storefront.accentLabel")} description={t("storefront.accentDesc")} labelFor={false}>
            {() => (
              <div role="group" aria-label={t("storefront.accentLabel")} className="flex flex-wrap gap-tight">
                {[null, ...CATEGORY_COLORS].map((c) => (
                  <button
                    key={c ?? "none"}
                    type="button"
                    aria-pressed={form.accent === c}
                    onClick={() => set({ accent: c })}
                    className={cn(
                      "flex h-11 items-center gap-tight rounded-sm border px-comfortable text-[13px] transition-colors duration-quick md:h-9",
                      form.accent === c ? "border-ember bg-ember/5 font-medium" : "border-line bg-card",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("h-3.5 w-3.5 rounded-full border", c ? `${COLOR_DOT[c]} border-transparent` : "border-dashed border-strong")}
                    />
                    {c ? t(`categories.colors.${c}`) : t("categories.colors.none")}
                  </button>
                ))}
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("storefront.contactTitle")} description={t("storefront.contactDesc")}>
          <SettingRow label={t("storefront.phoneLabel")}>
            {({ id }) => (
              <input id={id} type="tel" value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className={controlCls()} />
            )}
          </SettingRow>
          <SettingRow label={t("storefront.emailLabel")}>
            {({ id }) => (
              <input id={id} type="email" value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} className={controlCls()} />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection
          title={t("storefront.whatsOnTitle")}
          description={form.featured.length ? t("storefront.whatsOnChosen") : t("storefront.whatsOnAll")}
        >
          {sellable.length === 0 ? (
            <p className="px-section py-section text-sm text-muted sm:px-major">{t("storefront.nothingSellable")}</p>
          ) : (
            <ol className="divide-y divide-hairline">
              {[...ordered, ...rest].map((p) => {
                const on = ordered.includes(p);
                const i = ordered.indexOf(p);
                return (
                  <li key={p.id} className="flex items-center gap-tight px-section py-tight sm:px-major">
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        aria-label={t("storefront.moveUp", { name: p.name })}
                        disabled={!on || i === 0}
                        onClick={() => move(p.id, -1)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg disabled:pointer-events-none disabled:opacity-40 md:h-9 md:w-9"
                      >
                        <ArrowUp size={16} strokeWidth={1.5} aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={t("storefront.moveDown", { name: p.name })}
                        disabled={!on || i === ordered.length - 1}
                        onClick={() => move(p.id, 1)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg disabled:pointer-events-none disabled:opacity-40 md:h-9 md:w-9"
                      >
                        <ArrowDown size={16} strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>
                    <span className={cn("min-w-0 flex-1 truncate text-sm", on ? "text-fg" : "text-muted")}>{p.name}</span>
                    <Switch checked={on} onChange={() => toggle(p.id)} label={t("storefront.showSwitch", { name: p.name })} />
                  </li>
                );
              })}
            </ol>
          )}
          <p className="px-section py-comfortable text-[13px] text-muted sm:px-major">
            {t("storefront.showingCount", { count: showing.length })}
          </p>
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} invalid={!!slugErr} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Eye, Monitor, Plus, Smartphone, Ticket, X } from "lucide-react";
import { Button, EmptyState, PageShell, Sheet, StatusPill, useToast } from "@/components/ui";
import { PreviewFrame } from "@/components/PreviewFrame";
import { StorefrontPreviewApp } from "@/app/s/_components/flow/StorefrontPreviewApp";
import { cn } from "@/lib/cn";
import { demoNow } from "@/lib/schedule";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { useApiQuery } from "@/lib/useApi";
import {
  getStorefrontFor,
  listLocations,
  listProducts,
  listResources,
  listStaff,
  productSlugs,
  setStorefrontPublished,
  storefrontProducts,
  updateStorefront,
  type AccentColor,
  type Product,
  type Storefront,
  type StorefrontLink,
} from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch, controlCls } from "../../_components/SettingsKit";
import { ACCENT_COLORS, COLOR_DOT } from "../_components/ColorPicker";

interface Draft {
  slug: string;
  headline: string;
  intro: string;
  contactPhone: string;
  contactEmail: string;
  accent: AccentColor | null;
  heroImage: string | null;
  featured: string[];
  links: StorefrontLink[];
}

type Device = "desktop" | "phone";
const DEVICE: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1280, height: 860 },
  phone: { width: 390, height: 780 },
};

/** A link needs words to show and an address that is actually one. https
 *  only: a storefront is public, and an http link from it is a warning page. */
const linkErr = (l: StorefrontLink) => ({
  label: l.label.trim() ? undefined : ("linkLabelRequired" as const),
  url: /^https:\/\/[^\s./]+\.[^\s]+$/.test(l.url.trim()) ? undefined : ("linkUrlShape" as const),
});

const fromRecord = (s: Storefront): Draft => ({
  slug: s.slug,
  headline: s.headline ?? "",
  intro: s.intro ?? "",
  contactPhone: s.contactPhone ?? "",
  contactEmail: s.contactEmail ?? "",
  accent: s.accent ?? null,
  heroImage: s.heroImage ?? null,
  featured: [...s.featured],
  links: s.links.map((l) => ({ ...l })),
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
 *
 * **The preview is drawn from the draft**, beside the form on a wide screen and
 * one press away on a narrow one. A storefront is a page somebody else reads,
 * so the honest way to edit one is to look at it while typing — the pattern
 * Shopify's theme editor and Squarespace both settled on. It renders in a frame
 * at a real device width, so "Phone" is the page's own phone layout rather
 * than a desktop page squeezed into a column.
 *
 * Publishing lives here too, not only on the list: the moment somebody has
 * finished the page is the moment they are looking at it.
 */
export default function StorefrontEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const ts = useTranslations("storefront");
  const toast = useToast();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 200 }), []);
  const [record, setRecord] = useState<Storefront | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /* Which width the preview draws at, once somebody has chosen. Unchosen, it
     follows the room: beside the form the column fits a phone at nearly full
     size and a desktop at a third, so it opens on the phone; in the sheet
     there is the whole width, so it opens on the desktop. */
  const [picked, setPicked] = useState<Device | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const now = useMemo(() => demoNow(), []);
  /* Side by side only where both fit. Settings has its own menu beside the
     rail, so at 1440 the form and a preview split what is left into two
     columns neither of which works — measured, the form's labels broke a
     word to a line and the preview drew at a third. From 1536 the form keeps
     a fixed column and a phone preview fits beside it; below that the
     preview is a sheet with the whole width. Gated in JS rather than hidden
     with CSS so there is never a second, invisible copy of the page. */
  const wide = useMediaQuery("(min-width: 96rem)");
  const md = useMediaQuery(MD);
  const device: Device = picked ?? (wide || !md ? "phone" : "desktop");
  const setDevice = setPicked;

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
  const linkErrors = form.links.map(linkErr);
  const linksInvalid = linkErrors.some((e) => e.label || e.url);

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
      heroImage: form.heroImage,
      featured: form.featured,
      links: form.links.map((l) => ({ ...l, label: l.label.trim(), url: l.url.trim() })),
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

  /* Publishing acts on the SAVED page, so it waits for a save: publishing
     while the form says something else would put live a page nobody is
     looking at. */
  const publish = async (next: boolean) => {
    setPublishing(true);
    const res = await setStorefrontPublished(record.id, next);
    setPublishing(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setRecord(res.data);
    toast.success(t(next ? "storefront.published" : "storefront.unpublished", { name: location.name }));
  };

  const ordered = form.featured.length
    ? form.featured.map((id) => sellable.find((p) => p.id === id)).filter((p): p is Product => !!p)
    : sellable;
  const rest = sellable.filter((p) => !ordered.includes(p));
  /** The cover can only be a photo this venue already has on one of its
   *  bookings, so a page never points at an image nobody uploaded. */
  const heroChoices = sellable.flatMap((p) => (p.images ?? []).map((img) => ({ url: img.url, name: p.name, alt: img.alt ?? p.name })));

  const setLink = (i: number, patch: Partial<StorefrontLink>) =>
    set({ links: form.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  /** The page as it will read, from the draft — not the last save. A link
   *  that is half typed is left out rather than drawn broken. */
  const draftRecord: Storefront = {
    ...record,
    slug: form.slug.trim() || record.slug,
    headline: form.headline.trim() || undefined,
    intro: form.intro.trim() || undefined,
    contactPhone: form.contactPhone.trim() || undefined,
    contactEmail: form.contactEmail.trim() || undefined,
    accent: form.accent,
    heroImage: form.heroImage,
    featured: form.featured,
    links: form.links.filter((_, i) => !linkErrors[i].label && !linkErrors[i].url),
  };
  const preview = (d: Device) => (
    <PreviewFrame width={DEVICE[d].width} height={DEVICE[d].height} title={t("storefront.previewFrame", { name: location.name })}>
      <StorefrontPreviewApp
        storefront={draftRecord}
        location={location}
        products={showing}
        slugs={Object.fromEntries(productSlugs(showing))}
        resources={resourcesQ.data?.data ?? []}
        team={staffQ.data?.data ?? []}
        now={now}
      />
    </PreviewFrame>
  );
  const deviceSwitch = (
    <div role="radiogroup" aria-label={t("storefront.previewDevice")} className="inline-flex shrink-0 self-start rounded-sm border border-line bg-card p-[3px]">
      {(["desktop", "phone"] as const).map((d) => {
        const Icon = d === "desktop" ? Monitor : Smartphone;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={device === d}
            onClick={() => setDevice(d)}
            className={cn(
              "inline-flex min-h-9 items-center gap-inline rounded-xs px-comfortable text-[13px] font-medium transition-colors duration-quick",
              device === d ? "bg-ember-solid text-white" : "text-muted hover:text-fg",
            )}
          >
            <Icon size={14} strokeWidth={1.5} aria-hidden />
            {t(d === "desktop" ? "storefront.previewDesktop" : "storefront.previewPhone")}
          </button>
        );
      })}
    </div>
  );
  const previewState = (
    <p className="mt-inline flex items-center gap-inline text-[12px] text-muted">
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dirty ? "bg-warning" : "bg-success")} />
      {t(dirty ? "storefront.previewUnsaved" : "storefront.previewSaved")}
    </p>
  );

  return (
    <PageShell
      title={location.name}
      description={t("storefront.editorDescription")}
      actions={
        !wide ? (
          <Button variant="secondary" icon={<Eye size={16} strokeWidth={1.5} />} onClick={() => setPreviewOpen(true)}>
            {t("storefront.preview")}
          </Button>
        ) : undefined
      }
    >
      <div className="flex items-start gap-major">
        <div className={cn("flex min-w-0 flex-col gap-section pb-hero", wide ? "w-[36rem] shrink-0" : "max-w-3xl flex-1")}>
          {/* Where the page stands, first — whether anybody can see it is the
              question every other section here is in service of. */}
          {/* Stacked at every width: the buttons beside the words squeezed the
              words to a column of single words whenever the form was narrow. */}
          <section className="card-surface flex flex-col gap-section p-card">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-tight">
                <StatusPill tone={record.published ? "success" : "neutral"}>
                  {t(record.published ? "storefront.statusLive" : "storefront.statusDraft")}
                </StatusPill>
                <span className="min-w-0 truncate font-mono text-[13px] text-muted">/s/{record.slug}</span>
              </div>
              <p className="mt-tight text-[13px] leading-relaxed text-muted">
                {dirty ? t("storefront.saveFirst") : t(record.published ? "storefront.statusLiveDesc" : "storefront.statusDraftDesc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-tight">
              {record.published && (
                <>
                  <Button
                    variant="secondary"
                    icon={<Copy size={16} strokeWidth={1.5} />}
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${window.location.origin}/s/${record.slug}`);
                      toast.success(t("storefront.linkCopied"));
                    }}
                  >
                    {t("storefront.copyLink")}
                  </Button>
                  <Link href={`/s/${record.slug}`} target="_blank" rel="noreferrer">
                    <Button variant="secondary" icon={<ExternalLink size={16} strokeWidth={1.5} />}>
                      {t("storefront.viewPage")}
                    </Button>
                  </Link>
                </>
              )}
              <Button
                variant={record.published ? "secondary" : "primary"}
                loading={publishing}
                disabled={dirty}
                onClick={() => publish(!record.published)}
              >
                {t(record.published ? "storefront.unpublish" : "storefront.publish")}
              </Button>
            </div>
          </section>

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
                  placeholder={t("storefront.introPlaceholder")}
                  onChange={(e) => set({ intro: e.target.value })}
                  aria-describedby={describedBy}
                  className={cn(controlCls(), "h-auto py-tight leading-relaxed")}
                />
              )}
            </SettingRow>
            <SettingRow label={t("storefront.accentLabel")} description={t("storefront.accentDesc")} labelFor={false}>
              {() => (
                <div role="group" aria-label={t("storefront.accentLabel")} className="flex flex-wrap gap-tight">
                  {[null, ...ACCENT_COLORS].map((c) => (
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
                      {c ? t(`storefront.colors.${c}`) : t("storefront.colors.none")}
                    </button>
                  ))}
                </div>
              )}
            </SettingRow>
            <SettingRow label={ts("editor.heroLabel")} description={ts("editor.heroDesc")} layout="stack" labelFor={false}>
              {() => (
                <div role="group" aria-label={ts("editor.heroLabel")} className="grid grid-cols-2 gap-tight sm:grid-cols-3">
                  {[null, ...heroChoices].map((c) => {
                    const on = (form.heroImage ?? null) === (c?.url ?? null);
                    return (
                      <button
                        key={c?.url ?? "none"}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ heroImage: c?.url ?? null })}
                        className={cn(
                          "flex flex-col overflow-hidden rounded-sm border text-left text-[13px] transition-colors duration-quick",
                          on ? "border-ember ring-1 ring-ember" : "border-line hover:border-strong",
                        )}
                      >
                        {c ? (
                          // eslint-disable-next-line @next/next/no-img-element -- bundled/local assets
                          <img src={c.url} alt="" className="aspect-[16/10] w-full object-cover" />
                        ) : (
                          <span aria-hidden className="flex aspect-[16/10] w-full items-center justify-center bg-subtle text-muted">
                            <Ticket size={20} strokeWidth={1.5} />
                          </span>
                        )}
                        <span className="min-h-11 truncate px-comfortable py-tight font-medium leading-snug">
                          {c ? c.name : ts("editor.heroNone")}
                        </span>
                      </button>
                    );
                  })}
                  {heroChoices.length === 0 && <p className="col-span-full text-[13px] text-muted">{ts("editor.heroEmpty")}</p>}
                </div>
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("storefront.contactTitle")} description={t("storefront.contactDesc")}>
            <SettingRow label={t("storefront.phoneLabel")}>
              {({ id }) => (
                <input id={id} type="tel" value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} placeholder={t("storefront.phonePlaceholder")} className={controlCls()} />
              )}
            </SettingRow>
            <SettingRow label={t("storefront.emailLabel")}>
              {({ id }) => (
                <input id={id} type="email" value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} placeholder={t("storefront.emailPlaceholder")} className={controlCls()} />
              )}
            </SettingRow>
          </SettingsSection>

          <SettingsSection title={t("storefront.linksTitle")} description={t("storefront.linksDesc")}>
            {form.links.length === 0 ? (
              <p className="px-card pt-section text-sm text-muted">{t("storefront.linksEmpty")}</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {form.links.map((l, i) => {
                  const e = linkErrors[i];
                  const labelId = `sf-link-label-${l.id}`;
                  const urlId = `sf-link-url-${l.id}`;
                  return (
                    <li key={l.id} className="flex items-start gap-tight px-card py-comfortable">
                      <div className="grid min-w-0 flex-1 gap-tight sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                        <div>
                          <label htmlFor={labelId} className="text-[13px] font-medium text-fg">{t("storefront.linkLabel")}</label>
                          <input
                            id={labelId}
                            value={l.label}
                            onChange={(ev) => setLink(i, { label: ev.target.value })}
                            placeholder={t("storefront.linkPlaceholder")}
                            aria-invalid={!!e.label || undefined}
                            className={cn(controlCls(!!e.label), "mt-inline")}
                          />
                          {e.label && <p className="mt-inline text-[13px] text-danger">{t(`storefront.${e.label}`)}</p>}
                        </div>
                        <div>
                          <label htmlFor={urlId} className="text-[13px] font-medium text-fg">{t("storefront.linkUrl")}</label>
                          <input
                            id={urlId}
                            type="url"
                            inputMode="url"
                            value={l.url}
                            onChange={(ev) => setLink(i, { url: ev.target.value })}
                            placeholder={t("storefront.linkUrlPlaceholder")}
                            spellCheck={false}
                            aria-invalid={!!e.url || undefined}
                            className={cn(controlCls(!!e.url), "mt-inline font-mono")}
                          />
                          {e.url && <p className="mt-inline text-[13px] text-danger">{t(`storefront.${e.url}`)}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={t("storefront.linkRemove", { label: l.label || t("storefront.linkLabel") })}
                        onClick={() => set({ links: form.links.filter((_, j) => j !== i) })}
                        className="mt-[1.625rem] inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:h-9 md:w-9"
                      >
                        <X size={16} strokeWidth={1.5} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="px-card py-section">
              <Button
                variant="secondary"
                icon={<Plus size={16} strokeWidth={1.5} />}
                onClick={() => set({ links: [...form.links, { id: `lnk_${Date.now().toString(36)}`, label: "", url: "https://" }] })}
              >
                {t("storefront.linkAdd")}
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            title={t("storefront.whatsOnTitle")}
            description={form.featured.length ? t("storefront.whatsOnChosen") : t("storefront.whatsOnAll")}
          >
            {sellable.length === 0 ? (
              <p className="px-card py-section text-sm text-muted">{t("storefront.nothingSellable")}</p>
            ) : (
              <ol className="divide-y divide-hairline">
                {[...ordered, ...rest].map((p) => {
                  const on = ordered.includes(p);
                  const i = ordered.indexOf(p);
                  return (
                    <li key={p.id} className="flex items-center gap-tight px-card py-tight">
                      <div className="flex shrink-0">
                        <button
                          type="button"
                          aria-label={t("storefront.moveUp", { name: p.name })}
                          disabled={!on || i === 0}
                          onClick={() => move(p.id, -1)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg disabled:pointer-events-none disabled:opacity-40 md:h-9 md:w-9"
                        >
                          <ArrowUp size={16} strokeWidth={1.5} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={t("storefront.moveDown", { name: p.name })}
                          disabled={!on || i === ordered.length - 1}
                          onClick={() => move(p.id, 1)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg disabled:pointer-events-none disabled:opacity-40 md:h-9 md:w-9"
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
            <p className="px-card py-comfortable text-[13px] text-muted">
              {t("storefront.showingCount", { count: showing.length })}
            </p>
          </SettingsSection>

          <SaveBar dirty={dirty} saving={saving} invalid={!!slugErr || linksInvalid} onSave={save} onDiscard={() => setDraft(null)} />
        </div>

        {wide && (
          <aside aria-label={t("storefront.previewTitle")} className="sticky top-[4.5rem] flex min-w-0 flex-1 flex-col gap-comfortable pb-hero">
            <div className="flex flex-wrap items-start justify-between gap-tight">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-fg">{t("storefront.previewTitle")}</h2>
                {previewState}
              </div>
              {deviceSwitch}
            </div>
            <div className="rounded-md border border-line bg-subtle p-tight">
              <div className={cn("mx-auto overflow-hidden rounded-sm", device === "phone" && "max-w-[390px]")}>{preview(device)}</div>
            </div>
          </aside>
        )}
      </div>

      {!wide && (
        <Sheet
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title={t("storefront.previewTitle")}
          closeLabel={tc("close")}
          lead={previewState}
        >
          <div className="flex flex-col gap-comfortable p-card">
            {md && deviceSwitch}
            {previewOpen && <div className="overflow-hidden rounded-sm border border-line">{preview(md ? device : "phone")}</div>}
          </div>
        </Sheet>
      )}
    </PageShell>
  );
}

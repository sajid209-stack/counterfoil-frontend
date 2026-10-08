"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createStorefront, peekStorefronts, storefrontSlug, type Location, type Product, type Storefront } from "@/lib/api";
import { controlCls } from "../../_components/SettingsKit";

/**
 * Add a storefront to a venue: what to call it, where it will live, and which
 * bookings it shows.
 *
 * Three questions and no more — everything else (words, colour, links, contact)
 * is the editor's, which this lands on. The address is made from the name and
 * follows it until somebody types their own; what it will be is shown as the
 * whole web address rather than as a bare slug, because "lalbagh-fort-tours"
 * means nothing to somebody who has never seen a URL built.
 *
 * "Which bookings" defaults to everything the venue sells online, which is what
 * an empty list means on the record, so an operator who answers nothing gets a
 * page that stays right as the catalogue grows.
 */
export function AddStorefrontDialog({
  location,
  products,
  onClose,
  onCreated,
}: {
  location: Location;
  products: Product[];
  onClose: () => void;
  onCreated: (sf: Storefront) => void;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const uid = useId();
  const [name, setName] = useState("");
  /* null: the address follows the name. A string: somebody typed one. */
  const [typed, setTyped] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "some">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string; which?: string; general?: string }>({});

  const sellable = useMemo(
    () => products.filter((p) => p.status === "active" && p.channels.includes("online") && p.locationIds.includes(location.id)),
    [products, location.id],
  );

  const derived = name.trim() ? storefrontSlug(name, peekStorefronts().map((s) => s.slug)) : "";
  const slug = typed ?? derived;
  const host = typeof window === "undefined" ? "" : window.location.host;

  const submit = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("storefront.nameRequired", { venue: location.name });
    if (mode === "some" && picked.length === 0) next.which = t("storefront.whichNoneChosen");
    if (next.name || next.which) {
      setErrors(next);
      return;
    }
    setBusy(true);
    setErrors({});
    const res = await createStorefront({
      locationId: location.id,
      name,
      slug: typed !== null ? typed : undefined,
      featured: mode === "some" ? picked : [],
    });
    setBusy(false);
    if (!res.ok) {
      setErrors({ name: res.error.fieldErrors?.name, slug: res.error.fieldErrors?.slug, general: res.error.fieldErrors ? undefined : res.error.message });
      return;
    }
    toast.success(t("storefront.created", { name: res.data.name ?? name.trim() }));
    onCreated(res.data);
  };

  const modes = [
    { key: "all" as const, title: t("storefront.whichAll"), desc: t("storefront.whichAllDesc", { count: sellable.length }) },
    { key: "some" as const, title: t("storefront.whichSome"), desc: t("storefront.whichSomeDesc") },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={t("storefront.addTitle")}
      description={t("storefront.addBody", { venue: location.name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button loading={busy} onClick={submit}>
            {t("storefront.add")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-section"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t("storefront.nameLabel")} help={t("storefront.nameHelp")} error={errors.name} htmlFor={`${uid}-name`}>
          <input
            id={`${uid}-name`}
            data-autofocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((x) => ({ ...x, name: undefined, general: undefined }));
            }}
            placeholder={t("storefront.namePlaceholder", { venue: location.name })}
            autoComplete="off"
            aria-invalid={!!errors.name || undefined}
            aria-describedby={`${uid}-name-msg`}
            className={controlCls(!!errors.name)}
          />
        </Field>

        <Field label={t("storefront.addressLabel")} help={t("storefront.addressHelp")} error={errors.slug} htmlFor={`${uid}-slug`}>
          <div className="flex items-center gap-inline">
            <span className="shrink-0 font-mono text-[13px] text-muted">/s/</span>
            <input
              id={`${uid}-slug`}
              value={slug}
              onChange={(e) => {
                setTyped(e.target.value.toLowerCase());
                setErrors((x) => ({ ...x, slug: undefined, general: undefined }));
              }}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!errors.slug || undefined}
              aria-describedby={`${uid}-slug-msg`}
              className={cn(controlCls(!!errors.slug), "font-mono")}
            />
          </div>
          <p data-address-preview className="break-all text-[13px] text-muted">
            {t("storefront.addressPreview", { url: `${host}/s/${slug || "…"}` })}
          </p>
        </Field>

        <fieldset className="flex flex-col gap-tight">
          <legend className="mb-tight text-[0.75rem] font-medium text-muted">{t("storefront.whichLabel")}</legend>
          <div role="radiogroup" aria-label={t("storefront.whichLabel")} className="flex flex-col gap-tight">
            {modes.map((m) => {
              const on = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setMode(m.key);
                    setErrors((x) => ({ ...x, which: undefined }));
                  }}
                  className={cn(
                    "flex min-h-11 flex-col rounded-sm px-comfortable py-tight text-left transition-colors duration-quick",
                    on ? "bg-card ring-2 ring-inset ring-ember-solid" : "bg-muted-wash hover:ring-1 hover:ring-inset hover:ring-line",
                  )}
                >
                  <span className="text-sm font-medium text-fg">{m.title}</span>
                  <span className="text-[13px] text-muted">{m.desc}</span>
                </button>
              );
            })}
          </div>
          {mode === "some" && (
            <ul aria-label={t("storefront.whichLabel")} className="mt-tight flex max-h-48 flex-col overflow-y-auto rounded-sm border border-line">
              {sellable.length === 0 ? (
                <li className="px-comfortable py-comfortable text-[13px] text-muted">{t("storefront.nothingSellable")}</li>
              ) : (
                sellable.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <li key={p.id} className="border-b border-hairline last:border-b-0">
                      <label className="flex min-h-11 cursor-pointer items-center gap-tight px-comfortable py-tight text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]));
                            setErrors((x) => ({ ...x, which: undefined }));
                          }}
                          className="h-4 w-4 shrink-0 accent-[var(--color-ember-solid)]"
                        />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          )}
          {errors.which && <p className="text-[0.75rem] text-danger">{errors.which}</p>}
        </fieldset>

        {errors.general && <p className="text-[13px] text-danger">{errors.general}</p>}
      </form>
    </Modal>
  );
}

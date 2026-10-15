"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Check, ImagePlus } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { ALL_LOOKS, LOOK_KEY } from "@/lib/productPage";
import { ACCENT_HEX } from "@/lib/storefront/theme";
import type { AccentColor, PageLook, Product, ProductPage } from "@/lib/api/types";
import { eventAccents } from "./pageOps";

const CLASSIC_ACCENTS = Object.keys(ACCENT_HEX) as AccentColor[];

function Group({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-tight">
      <h3 className="text-md font-semibold text-fg">{title}</h3>
      {help && <p className="text-sm text-muted">{help}</p>}
      {children}
    </div>
  );
}

/**
 * One look, drawn small: its own ground, its own display face, its accent and
 * two lines of text, so the choice is made by looking. Classic has no theme of
 * its own and is drawn from the design system's tokens.
 */
function LookSwatch({ look }: { look: PageLook }) {
  const th = look === "standard" ? null : CATEGORIES.find((c) => c.id === look)?.theme;
  if (!th) {
    return (
      <span aria-hidden className="flex h-16 flex-col justify-between bg-card px-comfortable py-tight text-fg">
        <span className="text-xl font-semibold leading-none">Aa</span>
        <span className="flex items-center gap-tight">
          <span className="h-1.5 w-8 rounded-full bg-ember-solid" />
          <span className="h-1.5 flex-1 rounded-full bg-line" />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden className="flex h-16 flex-col justify-between px-comfortable py-tight" style={{ background: th.bg, color: th.fg }}>
      <span className="text-xl leading-none" style={{ fontFamily: th.display }}>Aa</span>
      <span className="flex items-center gap-tight">
        <span className="h-1.5 w-8 rounded-full" style={{ background: th.accent }} />
        <span className="h-1.5 flex-1 rounded-full" style={{ background: th.line }} />
      </span>
    </span>
  );
}

/**
 * Look, colour, cover and the line under the name: the choices that change how
 * the whole page feels, before any section's words. The same seven looks are
 * offered for every booking.
 */
export function LookControls({
  product,
  page,
  onLook,
  onPage,
}: {
  product: Product;
  page: ProductPage;
  onLook: (look: PageLook) => void;
  onPage: (patch: Partial<ProductPage>) => void;
}) {
  const t = useTranslations("catalog.page");
  const ts = useTranslations("settings");
  const looks = ALL_LOOKS;
  const file = useRef<HTMLInputElement>(null);

  const classic = page.look === "standard";
  const accents = classic
    ? CLASSIC_ACCENTS.map((k) => ({ key: k, hex: ACCENT_HEX[k], name: ts(`storefront.colors.${k}`) }))
    : eventAccents(page.look).map((hex, i) => ({ key: hex, hex, name: t("colourN", { n: i + 1 }) }));
  const photo = product.images[0]?.url;
  const cover = page.coverUrl ?? photo;
  const coverState = page.coverUrl ? t("coverUploaded") : photo ? t("coverFirst") : t("coverDesigned");

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onPage({ coverUrl: URL.createObjectURL(f) });
  };

  return (
    <div className="flex flex-col gap-major">
      <Group title={t("look")} help={t("lookHelp")}>
        <div role="radiogroup" aria-label={t("look")} className={cn("grid grid-cols-2 gap-tight", templateFontVars)}>
          {looks.map((l) => {
            const name = t(`looks.${LOOK_KEY[l]}`);
            const on = page.look === l;
            return (
              <label
                key={l}
                className={cn(
                  "relative flex cursor-pointer flex-col overflow-hidden rounded-inner bg-card ring-1 ring-inset ring-line transition-colors duration-quick ease-counterfoil hover:ring-strong",
                  "has-checked:ring-2 has-checked:ring-ember",
                  "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                )}
              >
                <input type="radio" name="page-look" value={l} checked={on} onChange={() => onLook(l)} className="peer sr-only" />
                <LookSwatch look={l} />
                <span className="flex min-h-11 items-center gap-tight px-comfortable py-tight text-sm font-medium text-fg">
                  <span className="min-w-0 flex-1">{name}</span>
                  {on && <Check size={14} strokeWidth={2.5} aria-hidden className="shrink-0 text-brand-foreground" />}
                </span>
              </label>
            );
          })}
        </div>
      </Group>

      <Group title={t("colour")}>
        <div role="group" aria-label={t("colour")} className="flex flex-wrap gap-tight">
          {classic && (
            <button
              type="button"
              onClick={() => onPage({ accent: undefined })}
              aria-pressed={!page.accent}
              aria-label={t("colourDefault")}
              title={t("colourDefault")}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-control bg-subtle text-xs font-medium text-fg-secondary ring-1 ring-inset ring-line transition-shadow duration-quick",
                !page.accent ? "ring-2 ring-ember" : "hover:ring-strong",
              )}
            >
              {!page.accent ? <Check size={16} strokeWidth={2.5} aria-hidden /> : t("colourDefaultShort")}
            </button>
          )}
          {accents.map((a) => {
            const on = (page.accent ?? "").toLowerCase() === a.hex.toLowerCase();
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => onPage({ accent: a.hex })}
                aria-pressed={on}
                aria-label={a.name}
                title={a.name}
                className={cn("relative h-11 w-11 rounded-control transition-shadow duration-quick", on ? "ring-2 ring-inset ring-inverse" : "ring-1 ring-inset ring-line hover:ring-strong")}
                style={{ background: a.hex }}
              >
                {on && <Check size={16} strokeWidth={2.5} aria-hidden className="absolute inset-0 m-auto text-on-solid drop-shadow-sm" />}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title={t("cover")} help={coverState}>
        {cover && (
          <span
            role="img"
            aria-label={t("coverPreview")}
            className="block aspect-video w-full rounded-inner bg-muted-wash bg-cover bg-center"
            style={{ backgroundImage: `url("${cover}")` }}
          />
        )}
        <div className="flex flex-wrap gap-tight">
          {page.coverUrl && (
            <Button variant="secondary" size="sm" onClick={() => onPage({ coverUrl: undefined })}>
              {photo ? t("coverUseFirst") : t("coverUseDesigned")}
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<ImagePlus size={15} strokeWidth={1.5} aria-hidden />} onClick={() => file.current?.click()}>
            {page.coverUrl ? t("coverReplace") : t("coverUpload")}
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </Group>

      <FormField
        label={t("tagline")}
        help={t("taglineHelp")}
        placeholder={t("taglinePlaceholder")}
        value={page.tagline ?? ""}
        onChange={(e) => onPage({ tagline: e.target.value })}
      />
    </div>
  );
}

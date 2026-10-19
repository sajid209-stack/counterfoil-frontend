"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { Button, Select, SegmentedControl, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { PageStyle } from "@/lib/api/types";
import { checkStyle, type Ground, STOREFRONT_GROUND } from "@/lib/pageStyle/resolve";
import { FONTS, PAIRINGS, fontById } from "@/lib/pageStyle/fontMeta";
import { pageFontVars } from "@/lib/pageStyle/fonts";
import { PALETTES, PRESETS, paletteStyle } from "@/lib/pageStyle/presets";

export { pageFontVars };

/** Errors (never notices) from `checkStyle` — parents disable Save on these. */
export function styleErrors(style: PageStyle, base: Ground = STOREFRONT_GROUND) {
  return checkStyle(style, base).filter((i) => i.severity === "error");
}

const HEX = /^#[0-9a-f]{6}$/i;

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-inner border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none select-none items-center justify-between gap-tight px-comfortable text-md font-semibold text-fg [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted transition-transform duration-quick group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-comfortable px-comfortable pb-comfortable">{children}</div>
    </details>
  );
}

function ColourRow({
  label,
  hint,
  value,
  fallback,
  resetLabel,
  onChange,
  error,
  notice,
}: {
  label: string;
  hint: string;
  value: string | undefined;
  /** The colour in use when nothing is chosen; absent means "worked out for you". */
  fallback?: string;
  resetLabel: string;
  onChange: (v: string | undefined) => void;
  error?: string;
  notice?: string;
}) {
  /* The typed text is local while it is being typed (a half-typed hex is not a
     colour yet), and follows the value when the value changes from outside —
     a palette or a preset — by remembering which value it was typed against. */
  const [draft, setDraft] = useState<{ base: string | undefined; text: string }>({ base: value, text: value ?? "" });
  const text = draft.base === value ? draft.text : value ?? "";
  const commit = (v: string) => {
    const next = v === "" ? undefined : HEX.test(v) ? v : value;
    setDraft({ base: next, text: v });
    if (v === "") onChange(undefined);
    else if (HEX.test(v)) onChange(v);
  };
  const shown = HEX.test(text) ? text : fallback;
  return (
    <div className="flex flex-col gap-inline">
      <div className="flex items-end gap-tight">
        <label
          className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-control border border-line"
          style={{ background: shown ?? "transparent" }}
        >
          {!shown && <span aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,transparent_46%,var(--color-strong)_46%,var(--color-strong)_54%,transparent_54%)]" />}
          <input
            type="color"
            aria-label={label}
            value={shown ?? "#ffffff" /* ds-exception: native colour input needs a literal fallback */}
            onChange={(e) => commit(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="min-w-0 flex-1">
          <span className="mb-1 block text-sm font-medium text-fg">{label}</span>
          <input
            value={text}
            onChange={(e) => commit(e.target.value.trim())}
            placeholder={hint}
            aria-label={`${label} (hex)`}
            spellCheck={false}
            className="h-11 w-full rounded-control border border-line bg-card px-tight text-sm text-fg placeholder:text-muted"
          />
        </div>
        {value && (
          <Button variant="tertiary" size="sm" onClick={() => commit("")}>
            {resetLabel}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && notice && <p className="text-sm text-muted">{notice}</p>}
    </div>
  );
}

export interface StylePanelProps {
  value: PageStyle;
  onChange: (next: PageStyle) => void;
  scope: "storefront" | "page";
  base?: Ground;
}

/**
 * The full style editor (docs/page-style.md). Controlled: the parent owns the
 * `PageStyle` value and decides when to save. `styleErrors` (exported above)
 * tells a parent whether it is safe to save.
 */
export function StylePanel({ value, onChange, scope, base = STOREFRONT_GROUND }: StylePanelProps) {
  const t = useTranslations("pageStyle");
  const [confirmPreset, setConfirmPreset] = useState<string | null>(null);
  const issues = checkStyle(value, base);
  const issueFor = (field: string) => issues.find((i) => i.field === field);

  const set = (patch: Partial<PageStyle>) => onChange({ ...value, ...patch });

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    onChange({ ...p.style });
  };
  const hasForeignFields = Object.keys(value).length > 0;

  const headingFont = fontById(value.headingFont);
  const bodyFontOptions = FONTS.filter((f) => f.body).map((f) => ({ value: f.id, label: f.name }));
  const headingFontOptions = FONTS.map((f) => ({ value: f.id, label: f.name }));

  return (
    <div className={cn("flex flex-col gap-section", pageFontVars)}>
      {/* Starting points */}
      <Group title={t("group.starting")}>
        <div className="grid grid-cols-2 gap-tight sm:grid-cols-3">
          {PRESETS.map((p) => {
            const hf = fontById(p.style.headingFont);
            const chosen = value.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => (hasForeignFields && !chosen ? setConfirmPreset(p.id) : applyPreset(p.id))}
                className={cn(
                  "flex flex-col gap-1 rounded-inner border p-tight text-left",
                  chosen ? "border-ember ring-1 ring-ember" : "border-line hover:border-strong",
                )}
                style={{ background: p.style.background, color: p.style.text }}
              >
                <span className="text-2xl leading-none" style={{ fontFamily: hf?.css }}>Aa</span>
                <span className="text-md leading-tight" style={{ fontFamily: hf?.css }}>{t(`preset.${p.id}`)}</span>
                <span aria-hidden className="mt-1 flex gap-1">
                  {[p.style.primary, p.style.secondary, p.style.surface].map((c, i) => (
                    <span key={i} className="h-3 w-6 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {/* Colours */}
      <Group title={t("group.colours")}>
        <div className="flex flex-wrap gap-tight">
          {PALETTES.map((pl) => (
            <button
              key={pl.id}
              type="button"
              title={t(`palette.${pl.id}`)}
              aria-label={t(`palette.${pl.id}`)}
              aria-pressed={value.palette === pl.id}
              onClick={() => set(paletteStyle(pl))}
              className={cn("flex h-11 w-20 overflow-hidden rounded-control border", value.palette === pl.id ? "border-fg ring-2 ring-fg" : "border-line")}
            >
              <span className="flex-1" style={{ background: pl.primary }} />
              <span className="flex-1" style={{ background: pl.secondary }} />
              <span className="flex-1" style={{ background: pl.background }} />
            </button>
          ))}
        </div>
        <ColourRow
          label={t("colour.primary")}
          hint={t("colour.primaryHelp")}
          value={value.primary}
          resetLabel={t("colour.reset")}
          onChange={(v) => set({ primary: v })}
          notice={issueFor("primary") ? t("colour.adjustedNotice") : undefined}
        />
        <ColourRow
          label={t("colour.secondary")}
          hint={t("colour.secondaryHelp")}
          value={value.secondary}
          resetLabel={t("colour.reset")}
          onChange={(v) => set({ secondary: v })}
          notice={issueFor("secondary") ? t("colour.adjustedNotice") : undefined}
        />
        <ColourRow
          label={t("colour.background")}
          hint={t("colour.backgroundHelp")}
          value={value.background}
          fallback={base.bg}
          resetLabel={t("colour.reset")}
          onChange={(v) => set({ background: v })}
          error={issueFor("text")?.code === "textUnreadable" ? t("colour.errorText", { ratio: issueFor("text")!.ratio.toFixed(1) }) : undefined}
        />
        <ColourRow label={t("colour.surface")} hint={t("colour.surfaceHelp")} value={value.surface} fallback={base.card} resetLabel={t("colour.reset")} onChange={(v) => set({ surface: v })}
          error={issueFor("surface")?.code === "textOnCards" ? t("colour.errorCards", { ratio: issueFor("surface")!.ratio.toFixed(1) }) : undefined} />
        <ColourRow label={t("colour.text")} hint={t("colour.textHelp")} value={value.text} fallback={base.fg} resetLabel={t("colour.reset")} onChange={(v) => set({ text: v })}
          error={issueFor("text")?.code === "textUnreadable" ? t("colour.errorText", { ratio: issueFor("text")!.ratio.toFixed(1) }) : undefined} />
      </Group>

      {/* Fonts */}
      <Group title={t("group.fonts")}>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t("font.heading")}</label>
          <Select value={value.headingFont ?? ""} onChange={(v) => set({ headingFont: v || undefined })} options={headingFontOptions} placeholder={t("font.default")} />
          <p className="text-lg" style={{ fontFamily: headingFont?.css }}>{t("font.sample")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t("font.body")}</label>
          <Select value={value.bodyFont ?? ""} onChange={(v) => set({ bodyFont: v || undefined })} options={bodyFontOptions} placeholder={t("font.default")} />
        </div>
        <div className="flex flex-wrap gap-tight">
          {PAIRINGS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => set({ headingFont: p.heading, bodyFont: p.body })}
              className="rounded-control border border-line px-tight py-1 text-xs text-fg hover:border-strong"
            >
              {fontById(p.heading)?.name} / {fontById(p.body)?.name}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t("font.weight")}</label>
          <SegmentedControl
            size="sm"
            aria-label={t("font.weight")}
            value={value.headingWeight ? String(value.headingWeight) : ""}
            onChange={(v) => set({ headingWeight: Number(v) as 400 | 500 | 600 | 700 | 800 })}
            options={[400, 500, 600, 700, 800]
              .filter((w) => !headingFont || (w >= headingFont.minWeight && w <= headingFont.maxWeight))
              .map((w) => ({ value: String(w), label: String(w) }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t("font.size")}</label>
          <SegmentedControl
            size="sm"
            aria-label={t("font.size")}
            value={value.typeScale ?? "standard"}
            onChange={(v) => set({ typeScale: v as PageStyle["typeScale"] })}
            options={[
              { value: "compact", label: t("font.scaleCompact") },
              { value: "standard", label: t("font.scaleStandard") },
              { value: "large", label: t("font.scaleLarge") },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t("font.letters")}</label>
          <SegmentedControl
            size="sm"
            aria-label={t("font.letters")}
            value={value.headingCase ?? "normal"}
            onChange={(v) => set({ headingCase: v as PageStyle["headingCase"] })}
            options={[
              { value: "normal", label: t("font.lettersNormal") },
              { value: "upper", label: t("font.lettersUpper") },
            ]}
          />
        </div>
      </Group>

      {/* Shape */}
      <Group title={t("group.shape")} defaultOpen={false}>
        <ChoiceRow label={t("shape.corners")} value={value.corners ?? "soft"} onChange={(v) => set({ corners: v as PageStyle["corners"] })}
          options={[{ value: "sharp", label: t("shape.cornersSharp") }, { value: "soft", label: t("shape.cornersSoft") }, { value: "round", label: t("shape.cornersRound") }]} />
        <ChoiceRow label={t("shape.buttons")} value={value.buttonStyle ?? "solid"} onChange={(v) => set({ buttonStyle: v as PageStyle["buttonStyle"] })}
          options={[{ value: "solid", label: t("shape.buttonsSolid") }, { value: "outline", label: t("shape.buttonsOutline") }, { value: "pill", label: t("shape.buttonsPill") }, { value: "underline", label: t("shape.buttonsUnderline") }]} />
        <ChoiceRow label={t("shape.cards")} value={value.cardStyle ?? "bordered"} onChange={(v) => set({ cardStyle: v as PageStyle["cardStyle"] })}
          options={[{ value: "flat", label: t("shape.cardsFlat") }, { value: "bordered", label: t("shape.cardsBordered") }, { value: "shadow", label: t("shape.cardsShadow") }, { value: "tinted", label: t("shape.cardsTinted") }]} />
      </Group>

      {/* Layout */}
      <Group title={t("group.layout")} defaultOpen={false}>
        <ChoiceRow label={t("layout.hero")} value={value.hero ?? "split"} onChange={(v) => set({ hero: v as PageStyle["hero"] })}
          options={[{ value: "split", label: t("layout.heroSplit") }, { value: "cover", label: t("layout.heroCover") }, { value: "editorial", label: t("layout.heroEditorial") }, { value: "collage", label: t("layout.heroCollage") }, { value: "text", label: t("layout.heroText") }]} />
        <ChoiceRow label={t("layout.heroHeight")} value={value.heroHeight ?? "medium"} onChange={(v) => set({ heroHeight: v as PageStyle["heroHeight"] })}
          options={[{ value: "short", label: t("layout.heightShort") }, { value: "medium", label: t("layout.heightMedium") }, { value: "tall", label: t("layout.heightTall") }]} />
        {value.hero === "cover" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">{t("layout.overlay")}</label>
            <input type="range" min={0} max={80} value={value.overlay ?? 45} onChange={(e) => set({ overlay: Number(e.target.value) })} />
          </div>
        )}
        <ChoiceRow label={t("layout.width")} value={value.width ?? "standard"} onChange={(v) => set({ width: v as PageStyle["width"] })}
          options={[{ value: "narrow", label: t("layout.widthNarrow") }, { value: "standard", label: t("layout.widthStandard") }, { value: "wide", label: t("layout.widthWide") }]} />
        <ChoiceRow label={t("layout.spacing")} value={value.spacing ?? "standard"} onChange={(v) => set({ spacing: v as PageStyle["spacing"] })}
          options={[{ value: "tight", label: t("layout.spacingTight") }, { value: "standard", label: t("layout.spacingStandard") }, { value: "airy", label: t("layout.spacingAiry") }]} />
        <ChoiceRow label={t("layout.dividers")} value={value.dividers ?? "none"} onChange={(v) => set({ dividers: v as PageStyle["dividers"] })}
          options={[{ value: "none", label: t("layout.dividersNone") }, { value: "line", label: t("layout.dividersLine") }]} />
        {scope === "page" && (
          <>
            <ChoiceRow label={t("layout.bookingPanel")} value={value.bookingPanel ?? "sidebar"} onChange={(v) => set({ bookingPanel: v as PageStyle["bookingPanel"] })}
              options={[{ value: "sidebar", label: t("layout.bookingSidebar") }, { value: "inline", label: t("layout.bookingInline") }]} />
            <ChoiceRow label={t("layout.gallery")} value={value.gallery ?? "mosaic"} onChange={(v) => set({ gallery: v as PageStyle["gallery"] })}
              options={[{ value: "mosaic", label: t("layout.galleryMosaic") }, { value: "grid", label: t("layout.galleryGrid") }, { value: "strip", label: t("layout.galleryStrip") }]} />
          </>
        )}
      </Group>

      {/* Details */}
      <Group title={t("group.details")} defaultOpen={false}>
        <ChoiceRow label={t("details.texture")} value={value.texture ?? "none"} onChange={(v) => set({ texture: v as PageStyle["texture"] })}
          options={[{ value: "none", label: t("details.textureNone") }, { value: "grain", label: t("details.textureGrain") }, { value: "dots", label: t("details.textureDots") }, { value: "lines", label: t("details.textureLines") }]} />
        <ChoiceRow label={t("details.tone")} value={value.imageTone ?? "none"} onChange={(v) => set({ imageTone: v as PageStyle["imageTone"] })}
          options={[{ value: "none", label: t("details.toneNone") }, { value: "warm", label: t("details.toneWarm") }, { value: "mono", label: t("details.toneMono") }, { value: "duotone", label: t("details.toneDuotone") }]} />
        <ChoiceRow label={t("details.icons")} value={value.iconStroke ?? "regular"} onChange={(v) => set({ iconStroke: v as PageStyle["iconStroke"] })}
          options={[{ value: "thin", label: t("details.iconsThin") }, { value: "regular", label: t("details.iconsRegular") }, { value: "bold", label: t("details.iconsBold") }]} />
      </Group>

      {/* Words */}
      <Group title={t("group.words")} defaultOpen={false}>
        <TextRow label={t("words.cta")} placeholder={t("words.ctaPlaceholder")} max={24} value={value.ctaLabel ?? ""} onChange={(v) => set({ ctaLabel: v || undefined })} />
        <TextRow label={t("words.price")} placeholder={t("words.pricePlaceholder")} max={16} value={value.priceLabel ?? ""} onChange={(v) => set({ priceLabel: v || undefined })} />
        <TextRow label={t("words.badge")} placeholder={t("words.badgePlaceholder")} max={28} value={value.badge ?? ""} onChange={(v) => set({ badge: v || undefined })} />
      </Group>

      <ConfirmDialog
        open={!!confirmPreset}
        onClose={() => setConfirmPreset(null)}
        onConfirm={() => { if (confirmPreset) applyPreset(confirmPreset); setConfirmPreset(null); }}
        title={t("preset.confirmTitle")}
        message={t("preset.confirmBody")}
        destructive={false}
      />
    </div>
  );
}

function ChoiceRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex items-center gap-1 rounded-control border px-tight py-1 text-xs",
                on ? "border-ember bg-ember-wash text-fg" : "border-line text-muted hover:border-strong",
              )}
            >
              {on && <Check size={12} strokeWidth={2.5} aria-hidden />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextRow({ label, placeholder, max, value, onChange }: { label: string; placeholder: string; max: number; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        maxLength={max}
        className="rounded-control border border-line bg-card px-tight py-1 text-sm text-fg"
      />
    </div>
  );
}

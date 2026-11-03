"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ImagePlus } from "lucide-react";
import { Button, FormField, SegmentedControl, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fileToStoredImage } from "@/lib/imageUpload";
import type { PageStyle } from "@/lib/api/types";
import { fontById } from "@/lib/pageStyle/fontMeta";
import { pageFontVars } from "@/lib/pageStyle/fonts";
import {
  ACCENTS,
  BACKGROUNDS,
  FONT_STYLES,
  LAYOUTS,
  accentOf,
  backgroundOf,
  backgroundPatch,
  fontStyleOf,
  fontStylePatch,
  type FontStyleId,
  type LayoutId,
} from "@/lib/pageStyle/presets";
import type { ResolvedStyle } from "@/lib/pageStyle/resolve";

export { styleErrors } from "@/lib/pageStyle/resolve";

export interface DesignPanelProps {
  /** The style that gets written to: the page's own, or the brand it was seeded from. */
  value: PageStyle;
  /** The same style, resolved, so the current choice is shown even when the
   *  record has no style of its own yet (an old page's look). */
  resolved: ResolvedStyle;
  onChange: (next: PageStyle) => void;
  scope: "page" | "storefront";
  /** Page scope: the cover the page uploaded, the picture used without one, and the setter. */
  coverUrl?: string;
  fallbackCover?: string;
  onCoverUrl?: (url: string | undefined) => void;
  /** Page scope: given only when the venue has a style to go back to. */
  onResetToBrand?: () => void;
  className?: string;
}

function Group({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-tight">
      <h3 className="text-md font-semibold text-fg">{title}</h3>
      {help && <p className="text-sm text-muted">{help}</p>}
      {children}
    </section>
  );
}

/** What stays in view when the cover is cropped: the same words the page uses. */
const CTA_MAX = 24;

/** The shape the chosen layout crops the photo to, so the preview shows what will show.
 *  Close to what the page draws; the page's own heights are the other renderer's. */
/**
 * The whole photo, uncropped: tap what must stay in view. One point works for every
 * crop, where Top/Middle/Bottom could not: a wide photo in a squarer frame is cut at its
 * sides, so moving it up or down did nothing. The page's preview shows the result.
 */
function FocusPicker({ src, value, onChange }: { src: string; value: string; onChange: (position: string) => void }) {
  const t = useTranslations("catalog.page");
  const [x, y] = value.split(" ").map((v) => parseInt(v, 10));
  const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
  const put = (nx: number, ny: number) => onChange(`${clamp(nx)}% ${clamp(ny)}%`);
  const STEP = 5;
  const keys: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] };
  return (
    <div className="flex flex-col gap-inline">
      <span className="text-sm font-medium text-fg">{t("design.focus.title")}</span>
      <span className="text-sm text-muted">{t("design.focus.help")}</span>
      <button
        type="button"
        aria-label={t("design.focus.position", { x, y })}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          // A keyboard press has no position: it must not throw the point to a corner.
          if (e.detail > 0) put(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
        }}
        onKeyDown={(e) => {
          const d = keys[e.key];
          if (!d) return;
          e.preventDefault();
          put(x + d[0], y + d[1]);
        }}
        className="relative block w-full cursor-crosshair overflow-hidden rounded-inner bg-muted-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="block h-auto w-full select-none" />
        <span
          aria-hidden
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-on-solid shadow-md ring-2 ring-inverse transition-[left,top] duration-quick motion-reduce:transition-none"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </button>
    </div>
  );
}

const barCls = "block h-1.5 rounded-full bg-strong";

/** A layout, drawn as the shape of the page: a photo block and lines of text. */
function Wireframe({ id }: { id: LayoutId }) {
  if (id === "cover") {
    return (
      <span aria-hidden className="relative block h-16 overflow-hidden rounded-xs bg-muted-wash">
        <span className="absolute inset-x-2 bottom-2 flex flex-col gap-1">
          <span className={cn(barCls, "w-3/4")} />
          <span className={cn(barCls, "w-1/2 opacity-60")} />
        </span>
      </span>
    );
  }
  if (id === "split") {
    return (
      <span aria-hidden className="flex h-16 gap-2 rounded-xs border border-line p-2">
        <span className="flex flex-1 flex-col justify-center gap-1">
          <span className={cn(barCls, "w-full")} />
          <span className={cn(barCls, "w-2/3 opacity-60")} />
          <span className={cn(barCls, "w-1/2 opacity-60")} />
        </span>
        <span className="block w-2/5 rounded-xs bg-muted-wash" />
      </span>
    );
  }
  return (
    <span aria-hidden className="flex h-16 flex-col gap-1 rounded-xs border border-line p-2">
      <span className={cn(barCls, "w-3/4")} />
      <span className={cn(barCls, "w-1/2 opacity-60")} />
      <span className="mt-0.5 block flex-1 rounded-xs bg-muted-wash" />
    </span>
  );
}

/** One swatch button: a ring that reads without colour (a check) when chosen. */
function swatchCls(on: boolean) {
  return cn(
    "relative h-11 w-11 shrink-0 rounded-control transition-shadow duration-quick",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    on ? "ring-2 ring-inset ring-inverse" : "ring-1 ring-inset ring-line hover:ring-strong",
  );
}

/** The font menu. Each style is drawn in its own face, which the app's Select
 *  cannot do (its options are plain strings), so this is a small listbox. */
function FontPicker({ current, onPick, label }: { current: FontStyleId | null; onPick: (id: FontStyleId) => void; label: string }) {
  const t = useTranslations("catalog.page");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const uid = useId();

  const face = (id: FontStyleId | null) => {
    const f = FONT_STYLES.find((x) => x.id === id);
    return f ? fontById(f.heading)?.css : undefined;
  };
  const caseOf = (id: FontStyleId | null) => (FONT_STYLES.find((x) => x.id === id)?.headingCase === "upper" ? "uppercase" : undefined);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const openList = () => {
    setOpen(true);
    /* Focus the chosen row once the list exists. */
    requestAnimationFrame(() => {
      const rows = list.current?.querySelectorAll<HTMLElement>('[role="option"]');
      const at = Array.from(rows ?? []).findIndex((r) => r.getAttribute("aria-selected") === "true");
      rows?.[at >= 0 ? at : 0]?.focus();
    });
  };
  const onKey = (e: React.KeyboardEvent) => {
    const rows = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const at = rows.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") rows[Math.min(rows.length - 1, at + 1)]?.focus();
    else if (e.key === "ArrowUp") rows[Math.max(0, at - 1)]?.focus();
    else if (e.key === "Home") rows[0]?.focus();
    else if (e.key === "End") rows[rows.length - 1]?.focus();
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") setOpen(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-tight">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-label={label}
        onClick={() => (open ? close(false) : openList())}
        className="flex min-h-11 w-full items-center gap-tight rounded-control border border-line bg-card px-comfortable text-left text-fg transition-colors duration-quick hover:border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="min-w-0 flex-1 truncate text-md" style={{ fontFamily: face(current), textTransform: caseOf(current) }}>
          {current ? t(`design.font.${current}`) : t("design.font.default")}
        </span>
        <ChevronDown size={18} strokeWidth={1.75} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>
      {open && (
        <div
          ref={list}
          id={`${uid}-list`}
          role="listbox"
          aria-label={label}
          onKeyDown={onKey}
          className="flex flex-col overflow-hidden rounded-inner border border-line bg-card"
        >
          {FONT_STYLES.map((f) => {
            const on = f.id === current;
            return (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={on}
                tabIndex={-1}
                onClick={() => {
                  onPick(f.id);
                  close(true);
                }}
                className={cn(
                  "flex min-h-11 items-center gap-tight border-b border-line px-comfortable text-left text-fg last:border-b-0 hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none",
                  on && "bg-ember-wash",
                )}
              >
                <span
                  aria-hidden
                  className="w-8 shrink-0 text-xl leading-none"
                  style={{ fontFamily: fontById(f.heading)?.css, textTransform: f.headingCase === "upper" ? "uppercase" : undefined }}
                >
                  Aa
                </span>
                <span className="min-w-0 flex-1 truncate text-md" style={{ fontFamily: fontById(f.heading)?.css, textTransform: f.headingCase === "upper" ? "uppercase" : undefined }}>
                  {t(`design.font.${f.id}`)}
                </span>
                {on && <Check size={16} strokeWidth={2.5} aria-hidden className="shrink-0 text-brand-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The Design tab (docs/page-design.md): layout, cover photo, colours, font and
 * a closed "More options". Controlled. `onChange` is given the whole next style
 * with cleared fields removed; the parent decides when it is saved.
 */
export function DesignPanel({ value, resolved, onChange, scope, coverUrl, fallbackCover, onCoverUrl, onResetToBrand, className }: DesignPanelProps) {
  const t = useTranslations("catalog.page");
  const tm = useTranslations("catalog.item");
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const radios = useId();
  const page = scope === "page";

  const set = (patch: PageStyle) => {
    const next: Record<string, unknown> = { ...value, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    onChange(next as PageStyle);
  };

  const layout = (LAYOUTS as readonly string[]).includes(resolved.hero) ? (resolved.hero as LayoutId) : null;
  const bg = backgroundOf(resolved);
  const accent = accentOf(resolved);
  const customAccent = accent === null;
  const font = fontStyleOf(resolved);
  const cover = coverUrl ?? fallbackCover;
  const coverState = coverUrl ? t("coverUploaded") : fallbackCover ? t("coverFirst") : t("coverDesigned");

  const pick = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      onCoverUrl?.(await fileToStoredImage(f));
    } catch {
      toast.error(tm("imageUnreadable"));
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-major", pageFontVars, className)}>
      <Group title={t("design.layout.title")}>
        <div role="radiogroup" aria-label={t("design.layout.title")} className="grid grid-cols-3 gap-tight">
          {LAYOUTS.map((l) => {
            const on = layout === l;
            return (
              <label
                key={l}
                className={cn(
                  "relative flex min-w-0 cursor-pointer flex-col gap-tight rounded-inner bg-card p-tight ring-1 ring-inset ring-line transition-colors duration-quick ease-counterfoil hover:ring-strong",
                  "has-checked:bg-ember-wash has-checked:ring-2 has-checked:ring-ember",
                  "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                )}
              >
                <input type="radio" name={`${radios}-layout`} value={l} checked={on} onChange={() => set({ hero: l })} className="sr-only" />
                <Wireframe id={l} />
                <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-fg">
                  <span className="min-w-0 flex-1 break-words">{t(`design.layout.${l}.name`)}</span>
                  {on && <Check size={14} strokeWidth={2.5} aria-hidden className="shrink-0 text-brand-foreground" />}
                </span>
                <span className="break-words text-xs text-muted">{t(`design.layout.${l}.desc`)}</span>
              </label>
            );
          })}
        </div>
      </Group>

      {page && (
        <Group title={t("cover")} help={coverState}>
          {cover && <FocusPicker src={cover} value={resolved.coverFocus} onChange={(coverFocus) => set({ coverFocus })} />}
          <div className="flex flex-wrap gap-tight">
            <Button variant="secondary" size="sm" icon={<ImagePlus size={15} strokeWidth={1.5} aria-hidden />} onClick={() => file.current?.click()}>
              {coverUrl ? t("coverReplace") : t("coverUpload")}
            </Button>
            {coverUrl && (
              <Button variant="tertiary" size="sm" onClick={() => onCoverUrl?.(undefined)}>
                {t("design.coverRemove")}
              </Button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files);
              e.target.value = "";
            }}
          />
        </Group>
      )}

      <Group title={t("design.colours.title")}>
        <div className="flex flex-col gap-tight">
          <span className="text-sm font-medium text-fg">{t("design.colours.background")}</span>
          <div role="group" aria-label={t("design.colours.background")} className="flex flex-wrap gap-tight">
            {BACKGROUNDS.map((b) => {
              const on = bg === b.id;
              const name = t(`design.bg.${b.id}`);
              return (
                <button key={b.id} type="button" aria-pressed={on} onClick={() => set(backgroundPatch(b.id))} className="flex w-16 flex-col items-center gap-1 text-xs text-fg focus-visible:outline-none">
                  <span className={cn(swatchCls(on), "flex w-16 items-center justify-center")} style={{ background: b.hex }}>
                    {on && <Check size={16} strokeWidth={2.5} aria-hidden className={b.id === "dark" ? "text-white" : "text-black"} />}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-tight">
          <span className="text-sm font-medium text-fg">{t("design.colours.accent")}</span>
          <div role="group" aria-label={t("design.colours.accent")} className="flex flex-wrap gap-tight">
            {ACCENTS.map((a) => {
              const on = accent === a.id;
              const name = t(`design.accent.${a.id}`);
              return (
                <button key={a.id} type="button" aria-pressed={on} aria-label={name} title={name} onClick={() => set({ primary: a.hex })} className={swatchCls(on)} style={{ background: a.hex }}>
                  {on && <Check size={16} strokeWidth={2.5} aria-hidden className="absolute inset-0 m-auto text-on-solid drop-shadow-sm" />}
                </button>
              );
            })}
            <label
              title={t("design.accent.custom")}
              className={cn(swatchCls(customAccent), "block cursor-pointer overflow-hidden has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring")}
              style={{ background: customAccent ? resolved.colours.accent : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" /* ds-exception: a colour wheel is the picture of "any colour" */ }}
            >
              <input
                type="color"
                aria-label={t("design.accent.custom")}
                value={resolved.colours.accent}
                onChange={(e) => set({ primary: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              {customAccent && <Check size={16} strokeWidth={2.5} aria-hidden className="absolute inset-0 m-auto text-on-solid drop-shadow-sm" />}
            </label>
          </div>
        </div>
      </Group>

      <Group title={t("design.font.title")}>
        <FontPicker current={font} label={t("design.font.title")} onPick={(id) => set(fontStylePatch(id))} />
      </Group>

      <Group title={t("design.more.corners")}>
        <SegmentedControl
          fullWidth
          aria-label={t("design.more.corners")}
          value={resolved.corners}
          onChange={(v) => set({ corners: v as PageStyle["corners"] })}
          options={(["sharp", "soft", "round"] as const).map((v) => ({ value: v, label: t(`design.corners.${v}`) }))}
        />
      </Group>

      <Group title={t("design.more.button")} help={t("design.more.buttonHelp")}>
        <FormField
          aria-label={t("design.more.button")}
          placeholder={page ? t("design.more.buttonDefault") : t("design.more.buttonDefaultShop")}
          value={value.ctaLabel ?? ""}
          autoComplete="off"
          onChange={(e) => set({ ctaLabel: e.target.value.slice(0, CTA_MAX) || undefined })}
        />
      </Group>

      {page && onResetToBrand && (
        <Button variant="tertiary" size="sm" className="self-start" onClick={onResetToBrand}>
          {t("design.useBrand")}
        </Button>
      )}
    </div>
  );
}


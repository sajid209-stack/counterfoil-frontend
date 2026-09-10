"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Check, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/cn";
import { EventTemplate } from "@/components/events/EventTemplate";
import { PreviewFrame } from "@/components/events/PreviewFrame";
import { templateFontVars } from "@/lib/events/fonts";
import {
  ACCENT_CHOICES,
  ALL_SECTIONS,
  FONT_CHOICES,
  REQUIRED_SECTIONS,
  categoryById,
  type CategoryId,
  type SectionId,
} from "@/lib/events/catalog";
import type { EventCustomisation, EventRecord } from "@/lib/api/events";

type Device = "desktop" | "tablet" | "mobile";

/** The widths the template actually LAYS OUT at. It is displayed scaled down to
 *  fit its column (see PreviewFrame), which is a paint-time operation and
 *  changes nothing the template can observe — narrowing the frame instead would
 *  be the lie, because then the media queries resolve at the wrong width. */
const FRAME: Record<Device, number> = { desktop: 1180, tablet: 820, mobile: 390 };

export function TemplateCustomiser({
  categoryId,
  event,
  value,
  onChange,
  now,
  labels,
}: {
  categoryId: CategoryId;
  event: EventRecord;
  value: EventCustomisation;
  onChange: (c: EventCustomisation) => void;
  now: Date;
  labels: Parameters<typeof EventTemplate>[0]["labels"];
}) {
  const t = useTranslations("events");
  const cat = categoryById(categoryId);
  const [device, setDevice] = useState<Device>("desktop");

  const set = (patch: Partial<EventCustomisation>) => onChange({ ...value, ...patch });

  const move = (id: SectionId, dir: -1 | 1) => {
    const i = value.sections.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.sections.length) return;
    const next = [...value.sections];
    [next[i], next[j]] = [next[j], next[i]];
    set({ sections: next });
  };

  const toggle = (id: SectionId) => {
    if (REQUIRED_SECTIONS.includes(id)) return;
    set(
      value.sections.includes(id)
        ? { sections: value.sections.filter((s) => s !== id) }
        : // Restored in the canonical order rather than on the end, so
          // switching a section off and on again does not reshuffle the page.
          { sections: ALL_SECTIONS.filter((s) => s === id || value.sections.includes(s)) },
    );
  };

  return (
    <div className="grid gap-section xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
      {/* ── Controls ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-section">
        <Group title={t("customise.accent")}>
          <div className="flex flex-wrap gap-tight">
            {ACCENT_CHOICES[categoryId].map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => set({ accent: hex })}
                aria-label={hex}
                aria-pressed={value.accent === hex}
                className={cn(
                  "relative h-11 w-11 rounded-sm border transition-colors duration-quick",
                  value.accent === hex ? "border-inverse" : "border-line hover:border-strong",
                )}
                style={{ background: hex }}
              >
                {value.accent === hex && (
                  <Check size={16} strokeWidth={2.5} className="absolute inset-0 m-auto text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </Group>

        <Group title={t("customise.type")}>
          <div className="grid gap-tight">
            <FontRow label={t("customise.display")} value={value.displayFont} onChange={(v) => set({ displayFont: v })} />
            <FontRow label={t("customise.body")} value={value.bodyFont} onChange={(v) => set({ bodyFont: v })} />
          </div>
        </Group>

        <Group title={t("customise.layout")}>
          <div className="flex flex-wrap gap-tight">
            {cat.variants.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set({ variant: v })}
                aria-pressed={value.variant === v}
                className={cn(
                  "min-h-11 rounded-sm border px-comfortable text-[13px] font-medium transition-colors duration-quick",
                  value.variant === v
                    ? "border-ember bg-ember/10 text-brand-foreground"
                    : "border-line text-muted hover:border-strong hover:text-fg",
                )}
              >
                {t(`variant.${v}`)}
              </button>
            ))}
          </div>
        </Group>

        <Group title={t("customise.sections")} help={t("customise.sectionsHelp")}>
          <ul className="flex flex-col">
            {value.sections.map((id, i) => {
              const locked = REQUIRED_SECTIONS.includes(id);
              return (
                <li key={id} className="flex items-center gap-tight border-b border-line py-inline last:border-0">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{t(`section.${id}`)}</span>
                  {locked ? (
                    <span className="shrink-0 text-[12px] text-muted">{t("customise.always")}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="shrink-0 rounded-xs px-tight py-inline text-[12px] text-muted hover:text-danger"
                    >
                      {t("customise.hide")}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t("customise.moveUp")}
                    disabled={i === 0}
                    onClick={() => move(id, -1)}
                    className="flex h-11 w-9 shrink-0 items-center justify-center text-muted disabled:opacity-30 hover:text-fg sm:h-8"
                  >
                    <ArrowUp size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("customise.moveDown")}
                    disabled={i === value.sections.length - 1}
                    onClick={() => move(id, 1)}
                    className="flex h-11 w-9 shrink-0 items-center justify-center text-muted disabled:opacity-30 hover:text-fg sm:h-8"
                  >
                    <ArrowDown size={14} strokeWidth={1.5} />
                  </button>
                </li>
              );
            })}
          </ul>
          {ALL_SECTIONS.filter((s) => !value.sections.includes(s)).length > 0 && (
            <div className="mt-tight flex flex-wrap gap-inline">
              {ALL_SECTIONS.filter((s) => !value.sections.includes(s)).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className="min-h-11 rounded-sm border border-dashed border-line px-comfortable text-[12px] text-muted transition-colors duration-quick hover:border-ember hover:text-fg sm:min-h-8"
                >
                  + {t(`section.${s}`)}
                </button>
              ))}
            </div>
          )}
        </Group>
      </div>

      {/* ── Live preview ───────────────────────────────────────────────── */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between gap-tight border-b border-line px-major py-comfortable">
          <h3 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("customise.preview")}</h3>
          <div className="flex shrink-0 items-center gap-inline">
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([d, Icon]) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-label={t(`device.${d}`)}
                aria-pressed={device === d}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-sm transition-colors duration-quick sm:h-9 sm:w-9",
                  device === d ? "bg-inverse text-inverse-fg" : "text-muted hover:bg-subtle hover:text-fg",
                )}
              >
                <Icon size={16} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>

        {/* Scaled to fit, never narrowed — see PreviewFrame. The template still
            lays out at the device's real width, so what you see wrap here is
            what wraps in production. */}
        <div className="bg-subtle p-comfortable">
          <div className={cn("mx-auto overflow-hidden rounded-sm shadow-md", templateFontVars)} style={{ maxWidth: FRAME[device] }}>
            <PreviewFrame width={FRAME[device]}>
              <EventTemplate
                event={{ ...event, customisation: value }}
                device={device === "mobile" ? "mobile" : "desktop"}
                labels={labels}
                now={now}
              />
            </PreviewFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-major">
      <h3 className="type-label text-[12px] text-muted">{title}</h3>
      {help && <p className="mt-inline text-[12px] text-muted">{help}</p>}
      <div className="mt-section">{children}</div>
    </div>
  );
}

function FontRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("events");
  return (
    <label className="flex flex-col gap-inline">
      <span className="text-[12px] text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-ember focus:ring-2 focus:ring-ember/20"
      >
        {FONT_CHOICES.map((f) => (
          <option key={f.id} value={f.css}>
            {t(`font.${f.key}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

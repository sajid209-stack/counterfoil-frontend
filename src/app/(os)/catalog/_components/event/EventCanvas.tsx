"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Check, Clock, ImagePlus, MapPin, Plus, RefreshCw, Trash2, Type, X } from "lucide-react";
import { DateField, TimeInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ACCENT_CHOICES, CATEGORIES, categoryById, FONT_CHOICES, type CategoryId } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { DEMO_TODAY } from "@/lib/schedule";
import { EventDays } from "./EventDays";
import type { EventContent } from "./EventArchitect";

/**
 * The invitation, typed on.
 *
 * An event is not a record you fill in, it is a thing you make — and the thing
 * you are making is a page somebody else will look at. The old first step was
 * a column of labelled inputs (EVENT NAME *, ONE LINE UNDERNEATH, KIND OF
 * EVENT…) with the page hidden behind a Continue button, so an operator wrote
 * a name without ever seeing where it lands or how big it is.
 *
 * Here the same four facts sit on the card they will print on: the cover at the
 * top, the name at display size in the look's own face, the line under it, and
 * when and where as three plain fields. Nothing is labelled in small caps,
 * because a placeholder that says "Name your event" is the label.
 *
 * The look strip is the one deliberate borrowing from consumer invite apps: a
 * row of named styles that change the whole page in one press. Ours are the
 * six event kinds, which carry a type, a palette and a section order — so the
 * control says what the event IS and changes how it looks, rather than asking
 * an operator to design one.
 */
export function EventCanvas({
  categoryId,
  content,
  onContent,
  errors,
  scopedTickets,
  onUntieTickets,
  accent,
  displayFont,
  onFont,
  onAccent,
  onCategory,
  details,
  onDetails,
  detailsAreSample = false,
}: {
  categoryId: CategoryId;
  content: EventContent;
  onContent: (patch: Partial<EventContent>) => void;
  errors: Record<string, string>;
  /** How many tickets are tied to a day, and how to untie them — going back
   *  to a single day must not leave them pointing at days that are gone. */
  scopedTickets?: number;
  onUntieTickets?: () => void;
  accent: string;
  displayFont: string;
  /** The face the title is set in — changed on the title itself. */
  onFont: (css: string) => void;
  /** The colour the page's art, rules and buttons are drawn from. */
  onAccent: (hex: string) => void;
  /** The page's own labelled facts: doors, dress code, parking, age. */
  details: { id: string; label: string; value: string }[];
  onDetails: (rows: { id: string; label: string; value: string }[]) => void;
  /** These rows are still the category's seeded examples. They are promises a
   *  guest acts on — an age policy, a door time, a standing capacity — so they
   *  say they are samples until somebody has looked at them. */
  detailsAreSample?: boolean;
  /** Changing the look changes the kind of event, its palette and its sections. */
  onCategory: (id: CategoryId) => void;
}) {
  const t = useTranslations("catalog.eventCanvas");
  const te = useTranslations("events");
  const tc = useTranslations("common");
  const file = useRef<HTMLInputElement>(null);
  const cat = categoryById(categoryId);
  const dateLabels = { previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") };

  const [fonts, setFonts] = useState(false);
  const fontWrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fonts) return;
    const away = (e: MouseEvent) => { if (fontWrap.current && !fontWrap.current.contains(e.target as Node)) setFonts(false); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setFonts(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [fonts]);

  /** A textarea that is as tall as its own text. Measured from the element in
   *  the event that changed it, never read during render. */
  const grow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };

  const read = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onContent({ coverUrl: String(r.result) });
    r.readAsDataURL(f);
  };

  return (
    /* The look's faces are declared here too: without them the title on the
       card falls back to the UI face while the page beside it is set in Bebas,
       and the one control that is supposed to show its effect shows nothing. */
    <div className={cn("card-surface overflow-hidden", templateFontVars)}>
      {/* The cover, at the page's own proportion. Empty, it is a themed plate
          rather than a dashed box: a page with no photograph still has a top,
          and this is what that top will look like. */}
      <div
        /* w-full is load-bearing: with only a min-height beside the aspect
           ratio the box takes its WIDTH from that height — 8rem at 21/6 is
           448px — and on a phone the cover buttons were pushed off the card
           and silently clipped. */
        className={cn("relative flex w-full items-end justify-end p-comfortable", content.coverUrl ? "aspect-[21/9]" : "aspect-[21/6] min-h-[8rem]")}
        style={{
          background: content.coverUrl
            ? `center / cover no-repeat url(${content.coverUrl})`
            : `radial-gradient(120% 120% at 20% 0%, ${accent}55, transparent 60%), radial-gradient(120% 120% at 90% 100%, ${accent}33, transparent 55%), ${cat.theme.bg}`,
        }}
      >
        <input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
        <div className="flex gap-tight">
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="flex min-h-11 items-center gap-inline rounded-sm bg-ink/70 px-comfortable text-[13px] font-medium text-white backdrop-blur transition-colors duration-quick hover:bg-ink/85 sm:min-h-9"
          >
            {content.coverUrl ? <RefreshCw size={14} strokeWidth={1.5} aria-hidden /> : <ImagePlus size={14} strokeWidth={1.5} aria-hidden />}
            {content.coverUrl ? t("replaceCover") : t("addCover")}
          </button>
          {content.coverUrl && (
            <button
              type="button"
              onClick={() => onContent({ coverUrl: "" })}
              aria-label={t("removeCover")}
              className="flex h-9 w-9 items-center justify-center rounded-sm bg-ink/70 text-white backdrop-blur transition-colors duration-quick hover:bg-ink/85"
            >
              <Trash2 size={14} strokeWidth={1.5} aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-section p-card">
        {/* The name, at the size it will be read at, in the face the page
            sets. `field-sizing` keeps the box honest as it grows. */}
        <div ref={fontWrap} className="relative">
          <div className="flex items-start gap-tight">
          {/* A textarea, not an input: a real event name — "Light & Line:
              Twenty Years of Dhaka Printmaking" — is longer than one line of
              38px display type, and an input cuts it mid-word with nothing to
              say more exists. It grows with the title and Enter is not a
              newline, so it behaves like the single field it looks like. */}
          <textarea
            value={content.title}
            rows={1}
            onChange={(e) => { onContent({ title: e.target.value }); grow(e.currentTarget); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            ref={(el) => { if (el) grow(el); }}
            placeholder={t("namePlaceholder")}
            aria-label={te("field.title")}
            aria-invalid={errors.title ? true : undefined}
            style={{ fontFamily: displayFont }}
            className={cn(
              "w-full resize-none overflow-hidden bg-transparent text-[30px] font-semibold leading-tight tracking-tight outline-none placeholder:text-muted/60 sm:text-[38px]",
              errors.title && "placeholder:text-danger/70",
            )}
          />
          {/* Partiful's one great idea: the typeface is a property of the
              title, changed on the title, seen immediately — not a setting
              filed three panels away under "branding". */}
          <button
            type="button"
            onClick={() => setFonts((v) => !v)}
            aria-expanded={fonts}
            title={t("font")}
            className="mt-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line text-muted transition-colors duration-quick hover:border-strong hover:text-fg sm:h-9 sm:w-9"
          >
            <Type size={16} strokeWidth={1.5} aria-hidden />
            <span className="sr-only">{t("font")}</span>
          </button>
          </div>
          {fonts && (
            /* Each tile sets the operator's OWN title, with the family
               named beside it: eight tiles reading "Aa" is a guessing game
               about a decision that changes the whole page. */
            <div className="absolute right-0 z-30 mt-inline flex w-[19rem] flex-col gap-inline rounded-md border border-line bg-card p-tight shadow-lg">
              {FONT_CHOICES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { onFont(f.css); setFonts(false); }}
                  aria-pressed={displayFont === f.css}
                  className={cn(
                    "flex min-h-11 items-baseline justify-between gap-section rounded-sm px-comfortable py-tight text-left transition-colors duration-quick",
                    displayFont === f.css ? "bg-inverse text-inverse-fg" : "hover:bg-subtle",
                  )}
                >
                  <span className="min-w-0 truncate text-[19px] leading-tight" style={{ fontFamily: f.css }}>
                    {content.title.trim() || t("namePlaceholder")}
                  </span>
                  <span className={cn("shrink-0 text-[12px]", displayFont === f.css ? "text-inverse-fg/70" : "text-muted")}>{t(`face.${f.key}`)}</span>
                </button>
              ))}
            </div>
          )}
          {errors.title && <p className="mt-inline text-[13px] text-danger">{errors.title}</p>}
          <input
            value={content.subtitle}
            onChange={(e) => onContent({ subtitle: e.target.value })}
            placeholder={t("taglinePlaceholder")}
            aria-label={te("field.subtitle")}
            className="mt-tight w-full bg-transparent text-[15px] text-muted outline-none placeholder:text-muted/60"
          />
        </div>

        {/* When and where. Named above the row rather than inside the
            controls: a placeholder disappears the moment it is answered, and a
            date field that reads "12 Aug 2026" with no label beside it is a
            number somebody has to infer. */}
        <div className="flex flex-col gap-tight border-t border-hairline pt-section">
          <p className="text-[12px] font-medium text-muted">{t("whenWhere")}</p>
          <div className="flex flex-col gap-tight sm:flex-row sm:flex-wrap sm:items-start">
          <Fact icon={<CalendarDays size={15} strokeWidth={1.5} aria-hidden />} error={errors.date}>
            <DateField
              value={content.date}
              today={DEMO_TODAY}
              onChange={(iso: string) => onContent({ date: iso })}
              labels={dateLabels}
              placeholder={t("datePlaceholder")}
              shape="inline"
            />
          </Fact>
          <Fact icon={<Clock size={15} strokeWidth={1.5} aria-hidden />} error={errors.ends}>
            <span className="flex flex-wrap items-center gap-inline">
              <TimeInput value={content.startTime} onChange={(v) => onContent({ startTime: v })} className="w-28" />
              {content.endTime !== "" ? (
                <>
                  <span className="text-muted">–</span>
                  <TimeInput value={content.endTime} onChange={(v) => onContent({ endTime: v })} className="w-28" />
                </>
              ) : (
                <button type="button" onClick={() => onContent({ endTime: "22:00" })} className="min-h-11 rounded-sm px-tight text-[13px] font-medium text-muted hover:bg-subtle hover:text-fg sm:min-h-9">
                  {t("addEnd")}
                </button>
              )}
            </span>
          </Fact>
          <Fact icon={<MapPin size={15} strokeWidth={1.5} aria-hidden />} error={errors.venueName} grow>
            <input
              value={content.venueName}
              onChange={(e) => onContent({ venueName: e.target.value })}
              placeholder={t("venuePlaceholder")}
              aria-label={te("field.venue")}
              aria-invalid={errors.venueName ? true : undefined}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </Fact>
          </div>
          <EventDays content={content} onContent={onContent} t={t} dateLabels={dateLabels} error={errors.days} scopedTickets={scopedTickets} onUntieTickets={onUntieTickets} />
        </div>

        {/* The colour the page is drawn from. It used to sit ON the cover,
            which meant it vanished under any light photograph and did not fit
            a phone's cover strip at all. */}
        <div className="flex flex-wrap items-center gap-tight border-t border-hairline pt-section">
          <span className="text-[12px] font-medium text-muted">{t("accent")}</span>
          {ACCENT_CHOICES[categoryId].map((hex) => {
            const on = accent.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => onAccent(hex)}
                aria-pressed={on}
                aria-label={t("accentOption", { hex })}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-quick hover:scale-110 sm:h-8 sm:w-8",
                  on ? "ring-2 ring-inverse ring-offset-2 ring-offset-card" : "ring-1 ring-line",
                )}
                style={{ background: hex }}
              >
                {/* A ring alone is the only cue that separates two dark
                    swatches, and two dark swatches are exactly what a
                    colour-blind operator cannot tell apart. */}
                {on && <Check size={15} strokeWidth={2.5} aria-hidden style={{ color: isLight(hex) ? "#141413" : "#fff" }} />}
              </button>
            );
          })}
        </div>

        {/* The details a venue is asked for over and over — doors, dress
            code, parking, age — as one-tap chips rather than a blank rich-text
            box. Each adds a labelled row the page draws in its About block. */}
        <div className="flex flex-col gap-tight border-t border-hairline pt-section">
          <div className="flex flex-wrap items-center gap-tight">
            <p className="text-[12px] font-medium text-muted">{t("details.title")}</p>
            {detailsAreSample && details.length > 0 && (
              <>
                <span className="rounded-full bg-warning-wash px-inline py-0.5 text-[12px] font-medium text-warning">{t("details.sample")}</span>
                <button
                  type="button"
                  onClick={() => onDetails([])}
                  className="ml-auto min-h-11 rounded-sm px-tight text-[13px] font-medium underline underline-offset-2 hover:bg-muted-wash sm:min-h-9"
                >
                  {t("details.clearSamples", { count: details.length })}
                </button>
              </>
            )}
          </div>
          {detailsAreSample && details.length > 0 && (
            <p className="text-[12px] text-muted">{t("details.sampleHelp")}</p>
          )}
          {details.length > 0 && (
            <ul className="flex flex-col gap-tight">
              {details.map((row, i) => (
                <li
                  key={row.id}
                  className={cn(
                    /* On a phone the label sits over its value rather than beside it: a
                       110px label column out of 358px cut "8,000 standing. No s"
                       mid-word, and a promise nobody can read is a promise nobody
                       checks. */
                    "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded-sm border px-comfortable py-tight sm:flex sm:gap-tight sm:py-0",
                    detailsAreSample ? "border-dashed border-line" : "border-line",
                  )}
                >
                  <span className="col-start-1 row-start-1 min-w-0 shrink-0 truncate text-[12px] font-medium text-muted sm:w-28 sm:py-tight sm:text-[13px]">{row.label}</span>
                  <input
                    value={row.value}
                    data-detail={row.id}
                    onChange={(e) => onDetails(details.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                    placeholder={t("details.placeholder")}
                    aria-label={row.label}
                    className={cn(
                      "col-span-2 row-start-2 min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted sm:col-auto sm:row-auto md:min-h-9",
                      detailsAreSample && "text-muted",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => onDetails(details.filter((_, j) => j !== i))}
                    aria-label={t("details.remove", { label: row.label })}
                    className="col-start-2 row-start-1 flex h-11 w-11 shrink-0 items-center justify-center justify-self-end rounded-sm text-muted hover:text-danger sm:h-9 sm:w-9"
                  >
                    <X size={14} strokeWidth={1.5} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-tight">
            {(["doors", "dress", "parking", "age", "accessibility", "food"] as const)
              .filter((k) => !details.some((r) => r.label === t(`details.${k}`)))
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    const id = `d${Date.now()}`;
                    onDetails([...details, { id, label: t(`details.${k}`), value: "" }]);
                    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-detail="${id}"]`)?.focus());
                  }}
                  className="flex min-h-11 items-center gap-inline rounded-full border border-dashed border-line px-comfortable text-[13px] text-muted transition-colors duration-quick hover:border-strong hover:text-fg sm:min-h-9"
                >
                  <Plus size={13} strokeWidth={1.5} aria-hidden />
                  {t(`details.${k}`)}
                </button>
              ))}
          </div>
        </div>

        {/* One press changes the type, the palette and what the page is made
            of — the single most expressive control an invite editor has. */}
        <div className="flex flex-col gap-tight border-t border-hairline pt-section">
          {/* Named for what it does. "Look" beside a kind pill that says
              Entertainment & Social reads as two taxonomies, and an operator
              who cannot tell whether a control changes the page's sections
              leaves it alone. It changes all of it, so it says so. */}
          <p className="text-[12px] font-medium text-muted">{t("look.title")}</p>
          <p className="-mt-inline text-[12px] text-muted">{t("look.help")}</p>
          <div className="flex flex-wrap gap-tight">
            {CATEGORIES.map((c) => {
              const on = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onCategory(c.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex min-h-11 items-center gap-tight rounded-full border px-comfortable text-[13px] transition-colors duration-quick sm:min-h-9",
                    on ? "border-inverse bg-inverse text-inverse-fg" : "border-line hover:border-strong",
                  )}
                >
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.theme.accent }} />
                  <span style={{ fontFamily: c.theme.display }}>{t(`look.${c.key}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Whether a check drawn on this colour should be ink or paper. */
const isLight = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
};

/** One fact on the card: a glyph, its control, and its refusal underneath. */
function Fact({ icon, children, error, grow = false }: { icon: React.ReactNode; children: React.ReactNode; error?: string; grow?: boolean }) {
  return (
    <span className={cn("flex min-w-0 flex-col", grow && "flex-1")}>
      <span
        className={cn(
          "flex min-h-11 min-w-0 items-center gap-tight rounded-sm border px-comfortable text-sm md:min-h-9",
          error ? "border-danger" : "border-line",
        )}
      >
        <span className="shrink-0 text-muted">{icon}</span>
        {children}
      </span>
      {error && <span className="mt-inline text-[13px] text-danger">{error}</span>}
    </span>
  );
}

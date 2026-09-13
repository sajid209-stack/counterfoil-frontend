"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  MapPin,
  Palette,
  Plus,
  Hash,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  Monitor,
  Smartphone,
  Tablet,
  Play,
  Handshake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DateField, FormField, TimeInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { EventTemplate } from "@/components/events/EventTemplate";
import { PreviewFrame } from "@/components/events/PreviewFrame";
import { templateFontVars } from "@/lib/events/fonts";
import { parseEventVideo } from "@/lib/events/video";
import { DEMO_TODAY } from "@/lib/schedule";
import {
  ACCENT_CHOICES,
  FONT_CHOICES,
  REQUIRED_SECTIONS,
  categoryById,
  type CategoryId,
  type SectionId,
} from "@/lib/events/catalog";
import type { EventCustomisation, EventLineupEntry, EventRecord } from "@/lib/api/events";

export interface EventContent {
  title: string;
  subtitle: string;
  date: string;
  startTime: string;
  venueName: string;
  venueAddress: string;
  description: string;
  coverUrl: string;
  /** A YouTube or Vimeo link, as pasted. Parsed at render time. */
  videoUrl: string;
  organiserName: string;
  organiserBlurb: string;
  lineup: EventLineupEntry[];
  faq: { id: string; q: string; a: string }[];
}

type Device = "desktop" | "tablet" | "mobile";

/** The widths the template LAYS OUT at. It is displayed scaled to fit its
 *  column (PreviewFrame) — a paint-time operation, so every breakpoint still
 *  resolves as it will in production. */
const FRAME: Record<Device, number> = { desktop: 1180, tablet: 820, mobile: 390 };

/** Sections this layout draws inside another row rather than on their own.
 *  Mirrors `PAIRS` in the template; the note keeps an operator from thinking a
 *  reorder did nothing. */
const PAIRED_INTO: Partial<Record<SectionId, SectionId>> = { tickets: "about", venue: "video" };

const SECTION_ICON: Record<SectionId, LucideIcon> = {
  hero: ImageIcon,
  countdown: Clock,
  stats: Hash,
  highlights: Sparkles,
  about: FileText,
  lineup: Users,
  schedule: Users,
  gallery: LayoutGrid,
  video: Play,
  sponsors: Handshake,
  tickets: Ticket,
  venue: MapPin,
  faq: HelpCircle,
};

/**
 * The event page architect.
 *
 * Look and content used to be two wizard steps: pick a template, then fill a
 * form and find out afterwards what it did to the page. They are one screen
 * now, because they are one decision — you write a lineup in order to see the
 * lineup, and the only way to know whether a subtitle is too long is to watch
 * it land.
 *
 * The accordion IS the section list. A row carries its own visibility switch
 * and its own place in the order, and expands to the fields that fill it — so
 * "what appears on the page", "in what order" and "what it says" are the same
 * control rather than three panels that have to be kept in agreement.
 */
export function EventArchitect({
  categoryId,
  event,
  custom,
  onCustom,
  content,
  onContent,
  onEvent,
  now,
  labels,
  errors,
}: {
  categoryId: CategoryId;
  event: EventRecord;
  custom: EventCustomisation;
  onCustom: (c: EventCustomisation) => void;
  content: EventContent;
  onContent: (patch: Partial<EventContent>) => void;
  onEvent: (patch: Partial<EventRecord>) => void;
  now: Date;
  labels: Parameters<typeof EventTemplate>[0]["labels"];
  errors: Record<string, string>;
}) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const cat = categoryById(categoryId);
  const [device, setDevice] = useState<Device>("desktop");
  const [open, setOpen] = useState<string>("hero");
  /* Matches the template: this is a variant decision, not a category one. */
  const structuredLayout = custom.variant === "structured";

  const setC = (patch: Partial<EventCustomisation>) => onCustom({ ...custom, ...patch });

  const move = (id: SectionId, dir: -1 | 1) => {
    const i = custom.sections.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= custom.sections.length) return;
    const next = [...custom.sections];
    [next[i], next[j]] = [next[j], next[i]];
    setC({ sections: next });
  };

  const hidden = (id: SectionId) => !custom.sections.includes(id);
  const toggle = (id: SectionId) => {
    if (REQUIRED_SECTIONS.includes(id)) return;
    setC(
      hidden(id)
        ? { sections: [...custom.sections, id] }
        : { sections: custom.sections.filter((s) => s !== id) },
    );
  };

  /** Rows are drawn in page order, with anything switched off collected at the
   *  end — so the list always reads as the page reads. */
  const rows: SectionId[] = [
    ...custom.sections,
    ...cat.sections.filter((s) => !custom.sections.includes(s)),
  ];

  const addLineup = () =>
    onContent({ lineup: [...content.lineup, { id: `l_${Date.now()}`, name: "", role: "", at: "" }] });
  const patchLineup = (id: string, p: Partial<EventLineupEntry>) =>
    onContent({ lineup: content.lineup.map((l) => (l.id === id ? { ...l, ...p } : l)) });
  const dropLineup = (id: string) => onContent({ lineup: content.lineup.filter((l) => l.id !== id) });

  /* Stats, highlights and the info trio live on the DRAFT rather than in the
     wizard's content object: they arrive seeded per category and are edited in
     place, so the patch goes back through the same setter the preview reads. */
  const onStat = (i: number, patch: Partial<{ value: string; label: string }>) =>
    onEvent({ stats: event.stats.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const onHighlight = (i: number, patch: Partial<{ label: string; description: string }>) =>
    onEvent({ highlights: event.highlights.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  const onInfo = (i: number, patch: Partial<{ label: string; value: string }>) =>
    onEvent({ info: event.info.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const onSponsor = (i: number, patch: Partial<{ name: string; tier: string }>) =>
    onEvent({ sponsors: event.sponsors.map((sp, j) => (j === i ? { ...sp, ...patch } : sp)) });
  const addSponsor = () =>
    onEvent({ sponsors: [...event.sponsors, { id: `sp_${Date.now()}`, name: "", tier: "" }] });
  const dropSponsor = () => onEvent({ sponsors: event.sponsors.slice(0, -1) });

  const addFaq = () => onContent({ faq: [...content.faq, { id: `f_${Date.now()}`, q: "", a: "" }] });
  const patchFaq = (id: string, p: Partial<{ q: string; a: string }>) =>
    onContent({ faq: content.faq.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  const dropFaq = (id: string) => onContent({ faq: content.faq.filter((f) => f.id !== id) });

  return (
    <div className="grid gap-section xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:items-start">
      {/* ── The architect ──────────────────────────────────────────────── */}
      <div className="card-surface overflow-hidden">
        <div className="border-b border-line px-major py-comfortable">
          <p className="type-label text-[12px] text-muted">{t("architect.title")}</p>
          <p className="mt-inline text-base font-semibold tracking-[-0.4px]">{t(`category.${cat.key}`)}</p>
        </div>

        {/* Brand identity is not a page section — it governs all of them, so it
            sits above the list rather than inside it. */}
        <Row
          icon={Palette}
          label={t("architect.brand")}
          open={open === "brand"}
          onToggle={() => setOpen(open === "brand" ? "" : "brand")}
        >
          <Field label={t("customise.accent")}>
            <div className="flex flex-wrap gap-inline">
              {ACCENT_CHOICES[categoryId].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setC({ accent: hex })}
                  aria-label={hex}
                  aria-pressed={custom.accent === hex}
                  className={cn(
                    "relative h-11 w-11 rounded-sm border transition-colors duration-quick",
                    custom.accent === hex ? "border-inverse" : "border-line hover:border-strong",
                  )}
                  style={{ background: hex }}
                >
                  {custom.accent === hex && (
                    <Check size={16} strokeWidth={2.5} className="absolute inset-0 m-auto text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("customise.display")}>
            <FontSelect value={custom.displayFont} onChange={(v) => setC({ displayFont: v })} />
          </Field>
          <Field label={t("customise.body")}>
            <FontSelect value={custom.bodyFont} onChange={(v) => setC({ bodyFont: v })} />
          </Field>
          <Field label={t("customise.layout")}>
            <div className="flex flex-wrap gap-inline">
              {cat.variants.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setC({ variant: v })}
                  aria-pressed={custom.variant === v}
                  className={cn(
                    "min-h-11 rounded-sm border px-comfortable text-[13px] font-medium transition-colors duration-quick",
                    custom.variant === v
                      ? "border-ember bg-ember/10 text-brand-foreground"
                      : "border-line text-muted hover:border-strong hover:text-fg",
                  )}
                >
                  {t(`variant.${v}`)}
                </button>
              ))}
            </div>
          </Field>
        </Row>

        {rows.map((id, i) => {
          const off = hidden(id);
          const locked = REQUIRED_SECTIONS.includes(id);
          const label = id === "lineup" ? t(`section.${cat.lineupKey}`) : t(`section.${id}`);
          return (
            <Row
              key={id}
              icon={SECTION_ICON[id]}
              label={label}
              muted={off}
              open={open === id}
              onToggle={() => setOpen(open === id ? "" : id)}
              controls={
                <>
                  <button
                    type="button"
                    aria-label={off ? t("architect.show") : t("customise.hide")}
                    disabled={locked}
                    onClick={(e) => { e.stopPropagation(); toggle(id); }}
                    className="flex h-9 w-9 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg disabled:opacity-30"
                  >
                    {off ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                  </button>
                  <button
                    type="button"
                    aria-label={t("customise.moveUp")}
                    disabled={off || i === 0}
                    onClick={(e) => { e.stopPropagation(); move(id, -1); }}
                    className="flex h-9 w-7 items-center justify-center text-muted transition-colors duration-quick hover:text-fg disabled:opacity-25"
                  >
                    <ArrowUp size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("customise.moveDown")}
                    disabled={off || i >= custom.sections.length - 1}
                    onClick={(e) => { e.stopPropagation(); move(id, 1); }}
                    className="flex h-9 w-7 items-center justify-center text-muted transition-colors duration-quick hover:text-fg disabled:opacity-25"
                  >
                    <ArrowDown size={14} strokeWidth={1.5} />
                  </button>
                </>
              }
            >
              {id === "hero" && (
                <>
                  <FormField
                    label={t("field.title")}
                    required
                    placeholder={t("field.titlePlaceholder")}
                    value={content.title}
                    onChange={(e) => onContent({ title: e.target.value })}
                    error={errors.title}
                  />
                  <FormField
                    label={t("field.subtitle")}
                    placeholder={t("field.subtitlePlaceholder")}
                    value={content.subtitle}
                    onChange={(e) => onContent({ subtitle: e.target.value })}
                  />
                  <div className="grid gap-tight sm:grid-cols-2">
                    <Field label={t("field.date")}>
                      <DateField
                        value={content.date}
                        today={DEMO_TODAY}
                        onChange={(v) => onContent({ date: v })}
                        labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
                      />
                    </Field>
                    <TimeInput label={t("field.time")} value={content.startTime} onChange={(v) => onContent({ startTime: v })} />
                  </div>
                  <FormField
                    label={t("field.cover")}
                    placeholder={t("field.coverPlaceholder")}
                    help={t("field.coverHelp")}
                    value={content.coverUrl}
                    onChange={(e) => onContent({ coverUrl: e.target.value })}
                  />
                </>
              )}

              {id === "countdown" && <Note>{t("architect.countdownNote")}</Note>}

              {id === "stats" && (
                <>
                  <Note>{t("architect.statsNote")}</Note>
                  {event.stats.map((st, i) => (
                    <div key={st.id} className="grid gap-tight sm:grid-cols-[8rem_minmax(0,1fr)]">
                      <FormField
                        label={t("architect.statValue")}
                        value={st.value}
                        onChange={(e) => onStat(i, { value: e.target.value })}
                      />
                      <FormField
                        label={t("architect.statLabel")}
                        value={st.label}
                        onChange={(e) => onStat(i, { label: e.target.value })}
                      />
                    </div>
                  ))}
                </>
              )}

              {structuredLayout && PAIRED_INTO[id] && (
                <Note>{t("architect.pairedWith", { section: t(`section.${PAIRED_INTO[id]}`) })}</Note>
              )}

              {id === "video" && (
                <>
                  <Note>{t("architect.videoNote")}</Note>
                  <FormField
                    label={t("architect.videoUrl")}
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={content.videoUrl}
                    onChange={(e) => onContent({ videoUrl: e.target.value })}
                  />
                  {/* Says whether the link took, at the moment it is typed. A
                      preview that silently shows nothing leaves the operator
                      guessing whether the section is off or the link is wrong. */}
                  {content.videoUrl.trim() !== "" && (
                    <p
                      className={cn(
                        "text-[13px]",
                        parseEventVideo(content.videoUrl) ? "text-muted" : "text-danger",
                      )}
                    >
                      {parseEventVideo(content.videoUrl) ? t("architect.videoOk") : t("architect.videoBad")}
                    </p>
                  )}
                </>
              )}

              {id === "sponsors" && (
                <>
                  <Note>{t("architect.sponsorsNote")}</Note>
                  {event.sponsors.map((sp, i) => (
                    <div key={sp.id} className="grid gap-tight sm:grid-cols-[minmax(0,1fr)_9rem]">
                      <FormField label={t("architect.sponsorName")} value={sp.name} onChange={(e) => onSponsor(i, { name: e.target.value })} />
                      <FormField label={t("architect.sponsorTier")} value={sp.tier ?? ""} onChange={(e) => onSponsor(i, { tier: e.target.value })} />
                    </div>
                  ))}
                  <div className="flex gap-tight">
                    <button
                      type="button"
                      onClick={addSponsor}
                      className="min-h-11 rounded-sm border border-line px-comfortable text-[13px] font-medium text-fg transition-colors duration-quick hover:bg-subtle"
                    >
                      {t("architect.addSponsor")}
                    </button>
                    {event.sponsors.length > 0 && (
                      <button
                        type="button"
                        onClick={dropSponsor}
                        className="min-h-11 rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:text-danger"
                      >
                        {t("architect.removeLast")}
                      </button>
                    )}
                  </div>
                </>
              )}

              {id === "highlights" && (
                <>
                  <Note>{t("architect.highlightsNote")}</Note>
                  <div className="grid gap-tight sm:grid-cols-2">
                    {event.highlights.map((h, i) => (
                      <FormField
                        key={h.id}
                        label={`${t("architect.chip")} ${i + 1}`}
                        value={h.label}
                        onChange={(e) => onHighlight(i, { label: e.target.value })}
                      />
                    ))}
                  </div>
                </>
              )}

              {id === "about" && (
                <>
                  <FormField
                    label={t("field.description")}
                    variant="textarea"
                    rows={5}
                    placeholder={t("field.descriptionPlaceholder")}
                    value={content.description}
                    onChange={(e) => onContent({ description: e.target.value })}
                  />
                  {/* The three facts sit with the prose they qualify rather
                      than in a panel of their own — an operator writing "no
                      seats, no barriers" is answering Capacity in the same
                      breath. */}
                  {/* The layouts that draw highlights as an argument beside
                      the ticket panel edit them here, where they appear.
                      There is no separate Highlights row on those templates. */}
                  {structuredLayout && event.highlights.length > 0 && (
                    <>
                      <Note>{t("architect.benefitsNote")}</Note>
                      {event.highlights.slice(0, 3).map((h, i) => (
                        <div key={h.id} className="grid gap-tight sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                          <FormField
                            label={`${t("architect.benefit")} ${i + 1}`}
                            value={h.label}
                            onChange={(e) => onHighlight(i, { label: e.target.value })}
                          />
                          <FormField
                            label={t("architect.benefitLine")}
                            value={h.description ?? ""}
                            onChange={(e) => onHighlight(i, { description: e.target.value })}
                          />
                        </div>
                      ))}
                    </>
                  )}
                  <div className="grid gap-tight sm:grid-cols-2">
                    <FormField
                      label={t("architect.organiser")}
                      placeholder={t("architect.organiserPlaceholder")}
                      value={content.organiserName}
                      onChange={(e) => onContent({ organiserName: e.target.value })}
                    />
                    <FormField
                      label={t("architect.organiserBlurb")}
                      value={content.organiserBlurb}
                      onChange={(e) => onContent({ organiserBlurb: e.target.value })}
                    />
                  </div>
                  <Note>{t("architect.infoNote")}</Note>
                  {event.info.map((f, i) => (
                    <div key={f.id} className="grid gap-tight sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <FormField label={t("architect.infoLabel")} value={f.label} onChange={(e) => onInfo(i, { label: e.target.value })} />
                      <FormField label={t("architect.infoValue")} value={f.value} onChange={(e) => onInfo(i, { value: e.target.value })} />
                    </div>
                  ))}
                </>
              )}

              {(id === "lineup" || id === "schedule") && (
                <>
                  {content.lineup.map((l) => (
                    <div key={l.id} className="rounded-sm border border-line bg-card p-comfortable">
                      <div className="mb-tight flex items-center justify-between gap-tight">
                        <span className="type-label text-[12px] text-muted">{t("architect.entry")}</span>
                        <button
                          type="button"
                          aria-label={t("tickets.remove")}
                          onClick={() => dropLineup(l.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:text-danger"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      </div>
                      <div className="grid gap-tight">
                        <FormField label={t("architect.name")} placeholder={t("architect.namePlaceholder")} value={l.name} onChange={(e) => patchLineup(l.id, { name: e.target.value })} />
                        {/* A break is not a speaker. One array feeds both the
                            bill and the agenda, so each entry has to say which
                            it is — otherwise "Lunch" turns up in the speaker
                            grid with a portrait. */}
                        <label className="grid gap-[6px]">
                          <span className="type-label text-[12px] text-muted">{t("architect.kind")}</span>
                          <select
                            value={l.kind ?? "person"}
                            onChange={(e) => patchLineup(l.id, { kind: e.target.value as "person" | "session" })}
                            className="min-h-11 rounded-sm border border-line bg-card px-comfortable text-[14px] text-fg"
                          >
                            <option value="person">{t("architect.kindPerson")}</option>
                            <option value="session">{t("architect.kindSession")}</option>
                          </select>
                        </label>
                        <div className="grid gap-tight sm:grid-cols-3">
                          <FormField label={t("architect.day")} placeholder={t("architect.dayPlaceholder")} value={l.day ?? ""} onChange={(e) => patchLineup(l.id, { day: e.target.value })} />
                          <FormField label={t("architect.role")} placeholder={t("architect.rolePlaceholder")} value={l.role ?? ""} onChange={(e) => patchLineup(l.id, { role: e.target.value })} />
                          <FormField label={t("architect.at")} placeholder="21:30" value={l.at ?? ""} onChange={(e) => patchLineup(l.id, { at: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <AddButton onClick={addLineup}>{t("architect.addEntry")}</AddButton>
                </>
              )}

              {id === "gallery" && <Note>{t("architect.galleryNote")}</Note>}
              {id === "tickets" && <Note>{t("architect.ticketsNote")}</Note>}

              {id === "venue" && (
                <>
                  <FormField
                    label={t("field.venue")}
                    required
                    placeholder={t("field.venuePlaceholder")}
                    value={content.venueName}
                    onChange={(e) => onContent({ venueName: e.target.value })}
                    error={errors.venueName}
                  />
                  <FormField
                    label={t("field.address")}
                    placeholder={t("field.addressPlaceholder")}
                    value={content.venueAddress}
                    onChange={(e) => onContent({ venueAddress: e.target.value })}
                  />
                </>
              )}

              {id === "faq" && (
                <>
                  {content.faq.map((f) => (
                    <div key={f.id} className="rounded-sm border border-line bg-card p-comfortable">
                      <div className="mb-tight flex items-center justify-between gap-tight">
                        <span className="type-label text-[12px] text-muted">{t("architect.question")}</span>
                        <button
                          type="button"
                          aria-label={t("tickets.remove")}
                          onClick={() => dropFaq(f.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:text-danger"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      </div>
                      <div className="grid gap-tight">
                        <FormField label={t("architect.q")} placeholder={t("placeholder.faqQ")} value={f.q} onChange={(e) => patchFaq(f.id, { q: e.target.value })} />
                        <FormField label={t("architect.a")} variant="textarea" rows={2} placeholder={t("placeholder.faqA")} value={f.a} onChange={(e) => patchFaq(f.id, { a: e.target.value })} />
                      </div>
                    </div>
                  ))}
                  <AddButton onClick={addFaq}>{t("architect.addQuestion")}</AddButton>
                </>
              )}
            </Row>
          );
        })}
      </div>

      {/* ── Live preview ───────────────────────────────────────────────── */}
      <div className="card-surface overflow-hidden xl:sticky xl:top-comfortable">
        <div className="flex items-center justify-between gap-tight border-b border-line px-major py-comfortable">
          <h3 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("customise.preview")}</h3>
          <div className="flex shrink-0 items-center gap-inline">
            {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
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
        <div className="max-h-[74vh] overflow-y-auto bg-subtle p-comfortable">
          <div className={cn("mx-auto overflow-hidden rounded-sm shadow-md", templateFontVars)} style={{ maxWidth: FRAME[device] }}>
            <PreviewFrame width={FRAME[device]}>
              <EventTemplate event={event} device={device === "mobile" ? "mobile" : "desktop"} labels={labels} now={now} />
            </PreviewFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── accordion row ───────────────────────────────────────────────────────── */

function Row({
  icon: Icon,
  label,
  open,
  onToggle,
  controls,
  muted,
  children,
}: {
  icon: LucideIcon;
  label: string;
  open: boolean;
  onToggle: () => void;
  controls?: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-0">
      <div className="flex items-center gap-inline pr-comfortable">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-comfortable px-major py-comfortable text-left transition-colors duration-quick hover:bg-subtle"
        >
          <Icon size={16} strokeWidth={1.5} className={cn("shrink-0", muted ? "text-muted/60" : "text-brand-foreground")} />
          <span className={cn("type-label min-w-0 flex-1 truncate text-[12px]", muted ? "text-muted/60" : "text-fg")}>{label}</span>
          <ChevronDown size={16} strokeWidth={1.5} className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
        </button>
        {controls && <span className="flex shrink-0 items-center">{controls}</span>}
      </div>
      {open && <div className="flex flex-col gap-section bg-subtle/40 px-major pb-major pt-tight">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-inline">
      <span className="type-label text-[12px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-muted">{children}</p>;
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-inline rounded-sm border border-dashed border-line text-[13px] text-muted transition-colors duration-quick hover:border-ember hover:text-fg"
    >
      <Plus size={15} strokeWidth={1.5} />
      {children}
    </button>
  );
}

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("events");
  return (
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
  );
}

export const SparklesIcon = Sparkles;
